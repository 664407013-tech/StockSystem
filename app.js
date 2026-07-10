import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// ⚠️ เปลี่ยน Config ตรงนี้เป็นของคุณทั้งหมด ⚠️
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAgMH_X7Vln0WX9xxgBSq7snby82gq54Nc",
  authDomain: "stocksystem-c88f7.firebaseapp.com",
  projectId: "stocksystem-c88f7",
  storageBucket: "stocksystem-c88f7.firebasestorage.app",
  messagingSenderId: "287552633400",
  appId: "1:287552633400:web:e81c4f2e94232dd4c044cd",
  measurementId: "G-N4XN8373HQ"
};

// เริ่มต้นใช้งาน Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ตัวแปรส่วนกลาง
let myChart = null;
let products = [];
let withdrawHistory = []; 
let unsubscribeProducts = null;
let unsubscribeHistory = null;

// ==========================================
// ส่วนที่ 1: ระบบ Authentication (ด่านตรวจคนเข้าเมือง)
// ==========================================
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const userDisplay = document.getElementById('currentUserDisplay');

// ดักจับสถานะล็อกอินแบบ Real-time
onAuthStateChanged(auth, (user) => {
    if (user) {
        // หากมี User (ล็อกอินแล้ว) ให้ซ่อนหน้าล็อกอิน และแสดงหน้าแอป
        loginScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        userDisplay.innerText = user.email; // แสดงอีเมลคนที่ล็อกอิน
        
        // เริ่มดึงข้อมูลจากฐานข้อมูลเมื่อล็อกอินสำเร็จเท่านั้น!
        loadData();
    } else {
        // หากไม่มี User (ยังไม่ล็อกอิน หรือกดออก) ให้แสดงแต่หน้าล็อกอิน
        loginScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
        userDisplay.innerText = "กำลังโหลด...";
        
        // หยุดการเชื่อมต่อฐานข้อมูลทันทีเพื่อป้องกันข้อมูลรั่วไหล
        if (unsubscribeProducts) unsubscribeProducts();
        if (unsubscribeHistory) unsubscribeHistory();
    }
});

// ฟังก์ชันกดปุ่มเข้าสู่ระบบ
document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorMsg = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    if (!email || !password) {
        errorMsg.innerText = "กรุณากรอกข้อมูลให้ครบถ้วน";
        errorMsg.classList.remove('hidden');
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังตรวจสอบ...';
    btn.disabled = true;
    errorMsg.classList.add('hidden');

    try {
        // คำสั่งยืนยันตัวตนกับ Firebase
        await signInWithEmailAndPassword(auth, email, password);
        // เคลียร์ช่องกรอกเมื่อล็อกอินผ่าน (onAuthStateChanged จะพาเข้าแอปเอง)
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        console.error("Login failed:", error);
        errorMsg.innerText = "อีเมลหรือรหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง";
        errorMsg.classList.remove('hidden');
    }

    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> เข้าสู่ระบบ';
    btn.disabled = false;
});

// ฟังก์ชันกดปุ่มออกจากระบบ
document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
        signOut(auth);
    }
});


// ==========================================
// ส่วนที่ 2: การควบคุมเมนูหน้าจอ (Navigation)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
            
            btn.classList.add('active');
            const target = btn.getAttribute('data-target');
            document.getElementById(target).classList.remove('hidden');

            if(window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('show');
            }
        });
    });

    const mobileBtn = document.getElementById('mobileMenuBtn');
    if(mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('show');
        });
    }
});

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}


// ==========================================
// ส่วนที่ 3: โหลดข้อมูลจาก Firestore (ทำงานตอนล็อกอินแล้วเท่านั้น)
// ==========================================
function loadData() {
    try {
        // ดึงข้อมูลสินค้า
        unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
            products = [];
            snapshot.forEach((doc) => {
                products.push({ id: doc.id, ...doc.data() });
            });
            updateUI();
        });

        // ดึงประวัติการเบิก
        unsubscribeHistory = onSnapshot(collection(db, "withdraw_history"), (snapshot) => {
            withdrawHistory = [];
            snapshot.forEach((doc) => {
                withdrawHistory.push({ id: doc.id, ...doc.data() });
            });
            withdrawHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // ใหม่ไปเก่า
            updateUI();
        });
    } catch (error) {
        console.error("Error loading data:", error);
        alert("ไม่สามารถดึงข้อมูลได้ โปรดตรวจสอบการเชื่อมต่อ");
    }
}

// ฟังก์ชันอัปเดตหน้าจอทั้งหมด
function updateUI(filteredHistory = null) {
    const tbody = document.getElementById('stockTableBody');
    const select = document.getElementById('withdrawSelect');
    
    if(!tbody || !select) return; 

    tbody.innerHTML = '';
    select.innerHTML = '<option value="">-- กรุณาเลือกสินค้า --</option>';

    let totalVal = 0;
    let chartLabels = [];
    let chartData = [];

    // วนลูปสร้างรายการสินค้า
    products.forEach(p => {
        const pQty = p.qty || 0;
        const pPrice = p.price || 0;
        const pCode = p.code || '-';
        const pName = p.name || 'ไม่ระบุ';

        totalVal += (pQty * pPrice);
        chartLabels.push(pName);
        chartData.push(pQty);

        const imgTag = p.image ? `<img src="${p.image}" class="w-10 h-10 rounded-lg object-cover shadow-sm">` : `<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><i class="fas fa-image"></i></div>`;
        
        tbody.innerHTML += `
            <tr class="hover:bg-indigo-50/50 transition-colors border-b border-gray-50">
                <td class="p-4">${imgTag}</td>
                <td class="p-4 font-medium text-gray-900">${pCode}</td>
                <td class="p-4">${pName}</td>
                <td class="p-4 ${pQty < 10 ? 'text-red-600 font-bold bg-red-50 rounded-lg px-2 py-1 inline-block mt-2' : 'text-gray-600'}">${pQty.toLocaleString()}</td>
                <td class="p-4 text-gray-600">฿${pPrice.toLocaleString()}</td>
                <td class="p-4 text-center">
                    <button class="text-red-500 hover:bg-red-100 p-2 rounded-lg transition" onclick="window.deleteProduct('${p.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;

        // เพิ่มเข้าในตัวเลือกการเบิก (ถ้าของหมดไม่ให้เลือก)
        if(pQty > 0) {
            select.innerHTML += `<option value="${p.id}">${pCode} - ${pName} (คงเหลือ: ${pQty})</option>`;
        }
    });

    document.getElementById('totalItemsDisplay').innerText = products.length.toLocaleString();
    document.getElementById('totalValueDisplay').innerText = totalVal.toLocaleString();

    // วาดกราฟ
    const chartCanvas = document.getElementById('stockChart');
    if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        if(myChart) myChart.destroy();
        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'จำนวนสินค้าคงเหลือ (ชิ้น)',
                    data: chartData,
                    backgroundColor: '#6366f1',
                    borderRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // วนลูปประวัติการเบิก
    const historyToRender = filteredHistory || withdrawHistory;
    const trackList = document.getElementById('trackingList');
    if(!trackList) return;

    trackList.innerHTML = '';
    if(historyToRender.length === 0) {
        trackList.innerHTML = '<div class="text-gray-400 text-sm text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">ไม่มีประวัติการทำรายการ</div>';
    } else {
        historyToRender.forEach(h => {
            const hCode = h.code || '-';
            const hName = h.itemName || '-';
            const hNote = h.note || 'ไม่ระบุ';
            
            trackList.innerHTML += `
                <div class="p-4 border border-gray-100 rounded-xl bg-white shadow-sm flex justify-between items-center mb-3 hover:shadow-md transition-shadow">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-md font-bold">สำเร็จ</span>
                            <span class="text-sm font-semibold text-gray-800">${h.docId}</span>
                        </div>
                        <p class="text-sm text-gray-700">เบิก: <strong>${hName}</strong> <span class="text-indigo-600 font-bold">(${h.qty} ชิ้น)</span></p>
                        <p class="text-xs text-gray-400 mt-1"><i class="fas fa-user-tag mr-1"></i> ${hNote} | <i class="far fa-clock ml-1 mr-1"></i> ${h.date}</p>
                    </div>
                    <button onclick="window.printPDF('${h.docId}', '${hName}', '${hCode}', '${h.qty}', '${hNote}', '${h.date}')" class="text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white p-3 rounded-xl transition-all" title="พิมพ์ใบเบิก">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            `;
        });
    }
}


// ==========================================
// ส่วนที่ 4: เพิ่ม/เบิก/ค้นหา (บันทึกข้อมูล)
// ==========================================

// ฟังก์ชันเพิ่มสินค้า
document.getElementById('addBtn').addEventListener('click', async () => {
    const codeVal = document.getElementById('itemCode').value.trim() || "-";
    const nameVal = document.getElementById('itemName').value.trim();
    const qtyVal = Number(document.getElementById('itemQty').value) || 0;
    const priceVal = Number(document.getElementById('itemPrice').value) || 0;
    const fileInput = document.getElementById('itemImage');
    
    if(!nameVal) return alert("กรุณากรอกชื่อสินค้า");

    const btn = document.getElementById('addBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

    let base64Image = '';
    if(fileInput.files.length > 0) {
        base64Image = await getBase64(fileInput.files[0]);
    }

    try {
        await addDoc(collection(db, "products"), {
            code: codeVal,
            name: nameVal,
            qty: qtyVal,
            price: priceVal,
            image: base64Image
        });

        // ล้างฟอร์ม
        document.getElementById('itemCode').value = '';
        document.getElementById('itemName').value = '';
        document.getElementById('itemQty').value = '';
        document.getElementById('itemPrice').value = '';
        fileInput.value = '';
        alert('เพิ่มสินค้าลงคลังเรียบร้อยแล้ว');
    } catch (e) {
        alert('เกิดข้อผิดพลาด: ' + e.message);
    }

    btn.innerHTML = '<i class="fas fa-save"></i> บันทึกข้อมูล';
    btn.disabled = false;
});

// ฟังก์ชันเบิกสินค้า
document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const id = document.getElementById('withdrawSelect').value;
    const qty = Number(document.getElementById('withdrawQty').value);
    const note = document.getElementById('withdrawNote').value.trim() || 'ไม่ระบุ';

    if(!id || qty <= 0) return alert('กรุณาเลือกสินค้าและระบุจำนวนให้ถูกต้อง');

    const product = products.find(p => p.id === id);
    if(!product) return alert('หาสินค้าในระบบไม่พบ');
    if(product.qty < qty) return alert(`สต็อกไม่พอ! (มีแค่ ${product.qty} ชิ้น)`);

    const btn = document.getElementById('withdrawBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังตัดสต็อก...';
    btn.disabled = true;

    try {
        // 1. อัปเดตสต็อกลดลง
        const newQty = product.qty - qty;
        await updateDoc(doc(db, "products", id), { qty: newQty });

        // 2. สร้างประวัติ
        const docId = 'DOC-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        await addDoc(collection(db, "withdraw_history"), {
            docId: docId,
            itemName: product.name || 'ไม่ระบุ',
            code: product.code || '-',
            qty: qty,
            note: note,
            date: dateStr,
            timestamp: Date.now()
        });

        // 3. ล้างฟอร์ม
        document.getElementById('withdrawQty').value = '';
        document.getElementById('withdrawNote').value = '';
        
        if(confirm('✅ ทำรายการเบิกสำเร็จเรียบร้อย! ต้องการพิมพ์ใบเบิกเป็น PDF หรือไม่?')) {
            window.printPDF(docId, product.name, product.code || '-', qty, note, dateStr);
        }
    } catch (e) {
        alert('ระบบเกิดข้อผิดพลาด: ' + e.message);
    }

    btn.innerHTML = '<i class="fas fa-check-circle"></i> ยืนยันการเบิก';
    btn.disabled = false;
});

// ค้นหาตามวันที่
document.getElementById('searchDateBtn').addEventListener('click', () => {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if(startDate && endDate) {
        const start = new Date(startDate).setHours(0,0,0,0);
        const end = new Date(endDate).setHours(23,59,59,999);
        const filtered = withdrawHistory.filter(h => h.timestamp >= start && h.timestamp <= end);
        updateUI(filtered);
    } else {
        alert("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบถ้วน");
    }
});

// ล้างการค้นหา
document.getElementById('clearSearchBtn').addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    updateUI();
});


// ==========================================
// ส่วนที่ 5: ฟังก์ชันที่เรียกใช้จาก HTML โดยตรง
// ==========================================

window.deleteProduct = async function(id) {
    if(confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้? ข้อมูลจะไม่สามารถกู้คืนได้')) {
        try {
            await deleteDoc(doc(db, "products", id));
        } catch (e) {
            alert("ลบสินค้าไม่สำเร็จ โปรดลองอีกครั้ง");
        }
    }
};

window.printPDF = function(docId, itemName, code, qty, user, date) {
    // กำหนดค่าลงในฟอร์ม PDF ที่ซ่อนอยู่
    document.getElementById('pdfDocId').innerText = docId;
    document.getElementById('pdfUser').innerText = user;
    document.getElementById('pdfDate').innerText = date;
    document.getElementById('pdfItemCode').innerText = code;
    document.getElementById('pdfItemName').innerText = itemName;
    document.getElementById('pdfItemQty').innerText = qty;

    const element = document.getElementById('pdfTemplate');
    element.classList.remove('hidden'); // แอบเปิดขึ้นมาแปบนึงให้ html2pdf อ่านค่า

    const opt = {
        margin: 10,
        filename: `ใบเบิกสินค้า_${docId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        element.classList.add('hidden'); // ปริ้นเสร็จซ่อนกลับไปเหมือนเดิม
    });
};
