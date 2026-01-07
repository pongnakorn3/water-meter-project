import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, TextInput, ActivityIndicator, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// ✅ IP ถูกต้อง (ตามที่พี่แจ้งมา)
const API_URL = 'http://192.168.102.31:3000'; 

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login'); 
  const [user, setUser] = useState(null); 
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // ข้อมูลการจดมิเตอร์
  const [selectedMeter, setSelectedMeter] = useState('water'); 
  const [imageUri, setImageUri] = useState(null);
  const [serverImagePath, setServerImagePath] = useState('');
  const [readingValue, setReadingValue] = useState('');
  const [roomNumber, setRoomNumber] = useState(''); 
  const [loading, setLoading] = useState(false);

  // --- 1. Login ---
  const handleLogin = async () => {
    if(!usernameInput || !passwordInput) return Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบ');
    
    setLoading(true);
    try {
      // ✅ เติม /api ให้ตรงกับ Backend แล้ว
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      
      const result = await response.json();
      if (result.success) {
        setUser(result.user);
        setCurrentScreen('menu');
        setUsernameInput('');
        setPasswordInput('');
      } else {
        Alert.alert('ผิดพลาด', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'เชื่อมต่อ Server ไม่ได้ (เช็ค IP/Firewall)');
    } finally {
      setLoading(false);
    }
  };

  // --- 2. เตรียมหน้าจดมิเตอร์ ---
  const selectMeter = (type) => {
    setSelectedMeter(type);
    setImageUri(null);
    setReadingValue('');
    setRoomNumber(''); 
    setServerImagePath('');
    setCurrentScreen('preview');
  };

  // --- 3. ถ่ายรูป & OCR ---
  const takePicture = async () => {
    // ขอสิทธิ์การใช้กล้อง
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('ขออภัย', 'ต้องการสิทธิ์กล้อง');

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, 
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      readMeterImage(uri);
    }
  };

  const readMeterImage = async (uri) => {
    setLoading(true);
    try {
      const formData = new FormData();
      // ตรงนี้สำคัญ: ต้องระบุ name, type, uri ให้ครบไม่งั้น Server รับไม่ได้
      formData.append('image', {
        uri: uri,
        type: 'image/jpeg',
        name: 'meter.jpg',
      });
      
      const response = await fetch(`${API_URL}/api/ocr`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setReadingValue(result.reading);
        setServerImagePath(result.image_path);
        Alert.alert('อ่านค่าเสร็จสิ้น', `อ่านได้เลข: ${result.reading}`);
      } else {
        Alert.alert('แจ้งเตือน', 'อ่านตัวเลขไม่ออก กรุณากรอกเอง');
      }
    } catch (error) {
      Alert.alert('Error', 'เชื่อมต่อ Server ไม่ได้');
    } finally {
      setLoading(false);
    }
  };

  // --- 4. บันทึกข้อมูล (Save) ---
  const saveData = async () => {
    if (!roomNumber) return Alert.alert('เตือน', 'กรุณากรอกเลขห้องครับ');
    if (!serverImagePath) return Alert.alert('เตือน', 'กรุณาถ่ายรูปก่อนครับ');
    if (!readingValue) return Alert.alert('เตือน', 'กรุณากรอกเลขมิเตอร์');

    setLoading(true);
    try {
      const payload = {
        reading: readingValue,
        image_path: serverImagePath,
        room_number: roomNumber,
        meter_type: selectedMeter,
        user_id: user.id 
      };

      const response = await fetch(`${API_URL}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        Alert.alert('สำเร็จ!', `บันทึกห้อง ${roomNumber} เรียบร้อย`, [
            { text: 'OK', onPress: () => setCurrentScreen('menu') }
        ]);
      } else {
        Alert.alert('บันทึกไม่สำเร็จ', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'บันทึกไม่ได้ เช็ค Server ครับ');
    } finally {
      setLoading(false);
    }
  };

  // ================= UI =================

  if (currentScreen === 'login') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <View style={styles.logoContainer}>
            <Ionicons name="water" size={80} color="#007AFF" />
            <Text style={styles.header}>ระบบจดมิเตอร์</Text>
        </View>
        <TextInput style={styles.input} placeholder="Username" value={usernameInput} onChangeText={setUsernameInput} autoCapitalize="none"/>
        <TextInput style={styles.input} placeholder="Password" secureTextEntry value={passwordInput} onChangeText={setPasswordInput}/>
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'menu') {
    return (
      <View style={styles.container}>
        <View style={styles.userInfo}>
            <Ionicons name="person-circle" size={40} color="#555" />
            <Text style={{fontSize: 18}}>ผู้จด: {user?.username}</Text>
        </View>
        <Text style={styles.header}>เลือกงานที่ต้องการ</Text>
        
        <TouchableOpacity style={[styles.menuButton, {backgroundColor: '#007AFF'}]} onPress={() => selectMeter('water')}>
            <Ionicons name="water" size={40} color="white" />
            <View><Text style={styles.menuText}>จดค่าน้ำ</Text><Text style={styles.subText}>Water Meter</Text></View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuButton, {backgroundColor: '#FF9500'}]} onPress={() => selectMeter('electric')}>
            <Ionicons name="flash" size={40} color="white" />
            <View><Text style={styles.menuText}>จดค่าไฟ</Text><Text style={styles.subText}>Electric Meter</Text></View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setCurrentScreen('login')} style={styles.logoutButton}>
            <Text style={{color: 'red'}}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'preview') {
    return (
      <ScrollView contentContainerStyle={{flexGrow: 1}}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.container, {justifyContent: 'flex-start', paddingTop: 60}]}>
          
          <TouchableOpacity style={styles.backArrow} onPress={() => setCurrentScreen('menu')}>
             <Ionicons name="arrow-back" size={30} color="#333" />
          </TouchableOpacity>

          <Text style={styles.title}>{selectedMeter === 'water' ? '💧 จดมิเตอร์น้ำ' : '⚡ จดมิเตอร์ไฟ'}</Text>

          {/* 1. ช่องกรอกเลขห้อง */}
          <View style={styles.card}>
             <Text style={styles.label}>🏠 เลขห้อง (Room No.)</Text>
             <TextInput style={styles.inputBox} placeholder="เช่น 101" value={roomNumber} onChangeText={setRoomNumber} keyboardType="numeric"/>
          </View>
          
          {/* 2. รูปถ่าย */}
          <View style={styles.imagePreviewContainer}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <View style={{alignItems: 'center'}}><Ionicons name="camera-outline" size={50} color="#ccc" /><Text style={{color: 'gray'}}>ยังไม่ได้ถ่ายรูป</Text></View>
            )}
          </View>
          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#007AFF'}]} onPress={takePicture}>
             <Ionicons name="camera" size={24} color="white" style={{marginRight: 10}} />
             <Text style={styles.buttonText}>{imageUri ? 'ถ่ายใหม่' : 'ถ่ายรูป'}</Text>
          </TouchableOpacity>

          {loading && <ActivityIndicator size="large" color="#007AFF" style={{marginVertical: 10}} />}

          {/* 3. เลขมิเตอร์ */}
          <View style={styles.card}>
             <Text style={styles.label}>🔢 เลขมิเตอร์</Text>
             <TextInput style={styles.inputBig} value={readingValue} onChangeText={setReadingValue} keyboardType="numeric" placeholder="0000"/>
          </View>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#28a745', marginBottom: 50}]} onPress={saveData} disabled={loading}>
             <Ionicons name="save" size={24} color="white" style={{marginRight: 10}} />
             <Text style={styles.buttonText}>บันทึกข้อมูล</Text>
          </TouchableOpacity>

        </KeyboardAvoidingView>
      </ScrollView>
    );
  }
  return <View />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  header: { fontSize: 26, fontWeight: 'bold', color: '#333', marginTop: 10 },
  userInfo: { position: 'absolute', top: 50, right: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { width: '85%', height: 55, backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 20, marginBottom: 15, borderWidth: 1, borderColor: '#e5e5ea', fontSize: 16 },
  inputBox: { width: '100%', height: 50, backgroundColor: '#f9f9f9', borderRadius: 8, paddingHorizontal: 15, borderWidth: 1, borderColor: '#ddd', fontSize: 18 },
  inputBig: { width: '100%', padding: 10, borderRadius: 8, backgroundColor: '#f9f9f9', fontSize: 32, textAlign: 'center', fontWeight: 'bold', color: '#333', borderWidth: 1, borderColor: '#ddd' },
  card: { width: '90%', backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  label: { fontSize: 16, color: '#666', marginBottom: 8, fontWeight: '600' },
  loginButton: { width: '85%', height: 55, backgroundColor: '#007AFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 5 },
  menuButton: { width: '90%', height: 110, borderRadius: 20, marginVertical: 10, alignItems: 'center', flexDirection: 'row', paddingHorizontal: 30, gap: 20, elevation: 5 },
  actionButton: { flexDirection: 'row', width: '90%', height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, elevation: 3 },
  logoutButton: { marginTop: 40, padding: 10 },
  menuText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  subText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  backArrow: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  imagePreviewContainer: { width: '90%', height: 220, backgroundColor: '#e1e1e6', borderRadius: 15, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 15, borderStyle: 'dashed', borderWidth: 2, borderColor: '#c7c7cc' },
  previewImage: { width: '100%', height: '100%' },
});