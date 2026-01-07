const express = require('express');
const multer = require('multer');
const tesseract = require('node-tesseract-ocr');
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors()); // ✅ อนุญาตให้ Web ยิงหา Backend ได้
app.use('/uploads', express.static('uploads')); // ✅ เปิดให้เข้าถึงรูปภาพได้

// --- Database ---
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'watermeter',
  password: 'password123',
  port: 5432,
});

// --- Config OCR ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `meter-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage: storage });

const TESSDATA_PATH = path.join(__dirname, 'tessdata');
const config = {
  lang: 'eng',
  oem: 1,
  psm: 7,
  "tessdata-dir": TESSDATA_PATH,
  tessedit_char_whitelist: '0123456789'
};

// ================= API ROUTES (สำหรับมือถือ) =================

// 1. Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'ไม่พบชื่อผู้ใช้' });

    const user = result.rows[0];
    if (password !== user.password) return res.status(401).json({ error: 'รหัสผ่านผิด' });

    res.json({ success: true, user: { id: user.id, username: user.username, name: user.full_name } });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 2. OCR
app.post('/api/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false });
    const processedPath = path.join(__dirname, 'uploads', `processed-${req.file.filename}`);
    const image = await Jimp.read(req.file.path);
    await image.resize(800, Jimp.AUTO).greyscale().contrast(0.5).writeAsync(processedPath);
    const text = await tesseract.recognize(processedPath, config);
    const cleanedText = text.trim().replace(/[^0-9]/g, '');
    const imagePathForDb = req.file.path.replace(/\\/g, "/");
    res.json({ success: true, reading: cleanedText, image_path: imagePathForDb });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// 3. Save (จดมิเตอร์)
app.post('/api/save', async (req, res) => {
  try {
    const { reading, image_path, room_number, meter_type, user_id } = req.body;
    const query = `
      INSERT INTO readings (reading_value, image_url, room_number, meter_type, recorded_by, created_at) 
      VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *
    `;
    const values = [reading || '0000', image_path, room_number, meter_type, user_id];
    await pool.query(query, values);
    res.json({ success: true, message: "Saved" });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ================= API ROUTES (สำหรับหน้าเว็บ Admin) =================

// 4. ดึงข้อมูลมิเตอร์ทั้งหมด (ใช้แสดงในตาราง Web)
app.get('/api/readings', async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id, 
        r.room_number, 
        r.meter_type, 
        r.reading_value, 
        r.image_url, 
        r.created_at,
        (CAST(r.reading_value AS INTEGER) - COALESCE(LAG(CAST(r.reading_value AS INTEGER)) OVER (PARTITION BY r.room_number, r.meter_type ORDER BY r.created_at), 0)) as usage,
        LAG(r.reading_value) OVER (PARTITION BY r.room_number, r.meter_type ORDER BY r.created_at) as previous_reading,
        (SELECT COUNT(*) FROM tenants t WHERE t.room_number = r.room_number) as tenant_count,
        (SELECT STRING_AGG(name, ', ') FROM tenants t WHERE t.room_number = r.room_number) as tenant_names
      FROM readings r
      ORDER BY r.created_at DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 5. ดึงรายชื่อผู้เช่าทั้งหมด
app.get('/api/tenants', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenants ORDER BY room_number ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. เพิ่มผู้เช่าใหม่
app.post('/api/tenants', async (req, res) => {
  const { name, room_number, student_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO tenants (name, room_number, student_id) VALUES ($1, $2, $3)',
      [name, room_number, student_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. ลบผู้เช่า
app.delete('/api/tenants/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= START SERVER =================
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server Running on port ${port}`);
  console.log(`👉 เชื่อมต่อได้ที่ IP: 192.168.102.31`); // ✅ ใช้ IP ปัจจุบันของพี่
});