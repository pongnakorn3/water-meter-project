import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx'; // กลับมาใช้ตัวนี้ ไม่ต้องง้อ Template
import Login from './Login';
import './App.css';

const API_BASE_URL = 'http://192.168.102.31:3000';
function App() {
  // --- State ---
  const [user, setUser] = useState(null); // เก็บสถานะ Login
  const [readings, setReadings] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // ข้อมูลฟอร์มเพิ่มคน
  const [newTenant, setNewTenant] = useState({ name: '', room: '', student_id: '' });

  // ค่าไฟ/น้ำ & ตัวกรอง
  const [waterRate, setWaterRate] = useState(17);
  const [elecRate, setElecRate] = useState(7);
  const [filterMonth, setFilterMonth] = useState("");

  // --- Functions ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/readings`);
      setReadings(response.data);
    } catch (error) { console.error("Error:", error); } 
    finally { setLoading(false); }
  };

  const fetchTenants = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tenants`);
      setTenants(res.data);
    } catch (error) { console.error("Error fetching tenants:", error); }
  };

  // โหลดข้อมูลเมื่อ Login ผ่านแล้วเท่านั้น
  useEffect(() => {
    if (user) {
      fetchData();
      fetchTenants();
    }
  }, [user]);

  // ฟังก์ชันเพิ่มคน
  const addTenant = async () => {
    if(!newTenant.name || !newTenant.room || !newTenant.student_id) {
      return alert('กรุณากรอกข้อมูลให้ครบ (ห้อง, รหัสนักศึกษา, ชื่อ)');
    }
    try {
      await axios.post(`${API_BASE_URL}/api/tenants`, { 
        name: newTenant.name, 
        room_number: newTenant.room,
        student_id: newTenant.student_id 
      });
      setNewTenant({ name: '', room: '', student_id: '' }); 
      fetchTenants(); 
      fetchData();    
    } catch(err) { alert('บันทึกไม่สำเร็จ: ' + err.message); }
  };

  const deleteTenant = async (id) => {
    if(!window.confirm('ยืนยันลบรายชื่อนี้?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/tenants/${id}`);
      fetchTenants();
      fetchData();
    } catch(err) { alert('ลบไม่สำเร็จ'); }
  };

  const calculateCost = (usage, type) => {
    if (!usage || usage < 0) return 0;
    return usage * (type === 'electric' ? elecRate : waterRate);
  };

  // --- Export Excel (แบบง่าย ไม่ต้องใช้ Template) ---
  const exportToExcel = () => {
    const dataToExport = filteredReadings.map(item => {
      const usage = item.usage > 0 ? item.usage : 0;
      const totalCost = calculateCost(usage, item.meter_type);
      const perHead = item.tenant_count > 0 ? totalCost / item.tenant_count : totalCost;

      return {
        "วันที่": new Date(item.created_at).toLocaleDateString('th-TH'),
        "ห้อง": item.room_number,
        "ผู้เช่า": item.tenant_names || '-',
        "ประเภท": item.meter_type === 'electric' ? 'ไฟฟ้า' : 'ประปา',
        "เลขก่อน": item.previous_reading || '-',
        "เลขหลัง": item.reading_value,
        "หน่วยที่ใช้": usage,
        "ราคา/หน่วย": item.meter_type === 'electric' ? elecRate : waterRate,
        "ยอดเงินรวม": Number(totalCost.toFixed(2)),
        "จำนวนคนหาร": item.tenant_count || 1,
        "ตกคนละ": Number(perHead.toFixed(2)),
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MeterReadings");
    // ตั้งชื่อไฟล์ตามวันที่
    XLSX.writeFile(wb, `รายงานค่าเช่า_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const filteredReadings = readings.filter(item => {
    if (!filterMonth) return true;
    return item.created_at.substring(0, 7) === filterMonth;
  });

  // --- ถ้ายังไม่ Login ให้โชว์หน้า Login ---
  if (!user) {
    return <Login onLoginSuccess={(userData) => setUser(userData)} />;
  }

  // --- หน้า Dashboard หลัก ---
  return (
    <div className="container" style={{maxWidth:'1000px', margin:'0 auto', padding:'20px', fontFamily:'Sarabun, sans-serif'}}>
      
      {/* Header */}
      <div style={{background:'#fff', padding:'20px', borderRadius:'15px', boxShadow:'0 5px 20px rgba(0,0,0,0.08)', marginBottom:'20px', position:'relative'}}>
        <div style={{position:'absolute', top:'15px', right:'15px', fontSize:'0.9em'}}>
           สวัสดี, <b>{user.name}</b> 
           <button onClick={()=>setUser(null)} style={{marginLeft:'10px', background:'#dc3545', color:'white', border:'none', padding:'5px 10px', borderRadius:'5px', cursor:'pointer'}}>ออกระบบ</button>
        </div>
        <h1 style={{margin:0, color:'#333'}}>🏢 ระบบจัดการหอพัก</h1>
        <p style={{margin:'5px 0 0', color:'#777'}}>จัดการมิเตอร์ คำนวณเงิน และออกรายงาน</p>
        
        <div style={{marginTop:'20px', display:'flex', gap:'15px', flexWrap:'wrap', alignItems:'center'}}>
           <div>💧 ค่าน้ำ: <input type="number" value={waterRate} onChange={e=>setWaterRate(Number(e.target.value))} style={{width:'50px', padding:'5px', border:'1px solid #ddd', borderRadius:'4px'}} /> ฿</div>
           <div>⚡ ค่าไฟ: <input type="number" value={elecRate} onChange={e=>setElecRate(Number(e.target.value))} style={{width:'50px', padding:'5px', border:'1px solid #ddd', borderRadius:'4px'}} /> ฿</div>
           
           <div style={{marginLeft:'auto', display:'flex', gap:'10px'}}>
             <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{padding:'8px', border:'1px solid #ddd', borderRadius:'5px'}} />
             <button onClick={fetchData} style={{background:'#17a2b8', color:'white', border:'none', padding:'8px 15px', borderRadius:'5px', cursor:'pointer'}}>🔄 รีเฟรช</button>
             <button onClick={exportToExcel} style={{background:'#28a745', color:'white', border:'none', padding:'8px 15px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>📥 Export Excel</button>
           </div>
        </div>
      </div>

      {/* Tenant Management */}
      <div style={{display:'flex', gap:'20px', flexWrap:'wrap', marginBottom:'20px'}}>
        <div style={{flex:1, background:'#fff', padding:'20px', borderRadius:'10px', boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}}>
          <h3 style={{marginTop:0, borderBottom:'2px solid #eee', paddingBottom:'10px'}}>👥 เพิ่มผู้เช่า</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            <div style={{display:'flex', gap:'10px'}}>
                <input placeholder="เลขห้อง" value={newTenant.room} onChange={e=>setNewTenant({...newTenant, room: e.target.value})} style={{padding:'10px', flex:1, border:'1px solid #ddd', borderRadius:'5px'}} />
                <input placeholder="รหัสนักศึกษา" value={newTenant.student_id} onChange={e=>setNewTenant({...newTenant, student_id: e.target.value})} style={{padding:'10px', flex:1, border:'1px solid #ddd', borderRadius:'5px'}} />
            </div>
            <div style={{display:'flex', gap:'10px'}}>
                <input placeholder="ชื่อ-นามสกุล" value={newTenant.name} onChange={e=>setNewTenant({...newTenant, name: e.target.value})} style={{padding:'10px', flex:1, border:'1px solid #ddd', borderRadius:'5px'}} />
                <button onClick={addTenant} style={{background:'#007bff', color:'white', border:'none', padding:'10px', borderRadius:'5px', cursor:'pointer', width:'80px'}}>+ เพิ่ม</button>
            </div>
          </div>
        </div>
        
        <div style={{flex:1, background:'#fff', padding:'20px', borderRadius:'10px', boxShadow:'0 4px 15px rgba(0,0,0,0.05)', maxHeight:'300px', overflowY:'auto'}}>
          <h3 style={{marginTop:0, fontSize:'1em'}}>รายชื่อในระบบ ({tenants.length})</h3>
          <table style={{width:'100%', fontSize:'0.9em', borderCollapse:'collapse'}}>
            <thead>
                <tr style={{background:'#f8f9fa', textAlign:'left'}}>
                    <th style={{padding:'8px'}}>ห้อง</th>
                    <th style={{padding:'8px'}}>รหัสนศ.</th>
                    <th style={{padding:'8px'}}>ชื่อ</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} style={{borderBottom:'1px solid #eee'}}>
                  <td style={{padding:'8px', fontWeight:'bold'}}>{t.room_number}</td>
                  <td style={{padding:'8px', color:'#555'}}>{t.student_id || '-'}</td>
                  <td style={{padding:'8px'}}>{t.name}</td>
                  <td style={{padding:'8px', textAlign:'right'}}>
                    <button onClick={()=>deleteTenant(t.id)} style={{background:'#ff4d4f', color:'white', border:'none', padding:'4px 8px', borderRadius:'3px', cursor:'pointer', fontSize:'0.8em'}}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-container" style={{background:'#fff', borderRadius:'10px', overflow:'hidden', boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}}>
        {loading ? <p style={{padding:'20px', textAlign:'center'}}>⏳ กำลังโหลด...</p> : (
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#343a40', color:'white', textAlign:'left'}}>
                <th style={{padding:'15px'}}>วันที่</th>
                <th style={{padding:'15px'}}>ห้อง / ผู้เช่า</th>
                <th style={{padding:'15px'}}>มิเตอร์</th>
                <th style={{padding:'15px'}}>ยอดเงิน</th>
                <th style={{padding:'15px'}}>หารคนละ</th>
                <th style={{padding:'15px'}}>หลักฐาน</th>
              </tr>
            </thead>
            <tbody>
              {filteredReadings.map((item) => {
                const usage = item.usage > 0 ? item.usage : 0;
                const totalCost = calculateCost(usage, item.meter_type);
                const perHead = item.tenant_count > 0 ? totalCost / item.tenant_count : totalCost;

                return (
                  <tr key={item.id} style={{borderBottom:'1px solid #eee'}}>
                    <td style={{padding:'15px'}}>
                      {new Date(item.created_at).toLocaleDateString('th-TH')}
                    </td>
                    <td style={{padding:'15px'}}>
                      <div style={{fontWeight:'bold', fontSize:'1.2em'}}>{item.room_number}</div>
                      <div style={{fontSize:'0.85em', color:'#555', marginTop:'4px'}}>
                        {item.tenant_names ? `👤 ${item.tenant_names}` : <span style={{color:'orange'}}>⚠️ ว่าง</span>}
                      </div>
                    </td>
                    <td style={{padding:'15px'}}>
                      <span style={{padding:'4px 8px', borderRadius:'12px', fontSize:'0.8em', fontWeight:'bold', marginRight:'10px', background: item.meter_type==='electric'?'#fff3cd':'#d1ecf1', color: item.meter_type==='electric'?'#856404':'#0c5460'}}>
                        {item.meter_type==='electric'?'⚡ ไฟ':'💧 น้ำ'}
                      </span>
                      {usage} หน่วย
                      <div style={{fontSize:'0.8em', color:'#999'}}>{item.previous_reading||0} ➜ {item.reading_value}</div>
                    </td>
                    <td style={{padding:'15px', color:'#d32f2f', fontWeight:'bold', fontSize:'1.1em'}}>{totalCost.toLocaleString()} ฿</td>
                    <td style={{padding:'15px'}}>
                      <div style={{color:'#28a745', fontWeight:'bold'}}>{perHead.toFixed(2)} ฿</div>
                      <div style={{fontSize:'0.8em', color:'#999'}}>(หาร {item.tenant_count || 1})</div>
                    </td>
                    <td style={{padding:'15px'}}>
                      {item.image_url && (
                        <a href={`${API_BASE_URL}/${item.image_url}`} target="_blank" rel="noreferrer">
                          <img src={`${API_BASE_URL}/${item.image_url}`} alt="proof" style={{height:'40px', borderRadius:'5px', border:'1px solid #ddd'}}/>
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;