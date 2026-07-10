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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let myChart = null;
let products = [];
let withdrawHistory = []; 
let unsubscribeProducts = null;
let unsubscribeHistory = null;

// ==========================================
// ส่วนที่ 1: ระบบ Authentication
// ==========================================
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const userDisplay = document.getElementById('currentUserDisplay');

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        userDisplay.innerText = user.email; 
        loadData();
    } else {
        loginScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
        userDisplay.innerText = "กำลังโหลด...";
        if (unsubscribeProducts) unsubscribeProducts();
        if (unsubscribeHistory) unsubscribeHistory();
    }
});

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
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        errorMsg.innerText = "อีเมลหรือรหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง";
        errorMsg.classList.remove('hidden');
    }

    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> เข้าสู่ระบบ';
    btn.disabled = false;
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
        signOut(auth);
    }
});

// ==========================================
// ส่วนที่ 2: Navigation & Helpers
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.remove('hidden');

            if(window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('show');
            }
        });
    });

    const mobileBtn = document.getElementById('mobileMenuBtn');
    if(mobileBtn) mobileBtn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('show'));
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
// ส่วนที่ 3: ดึงข้อมูลและอัปเดตหน้าจอ
// ==========================================
function loadData() {
    try {
        unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
            products = [];
            snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
            updateUI();
        });

        unsubscribeHistory = onSnapshot(collection(db, "withdraw_history"), (snapshot) => {
            withdrawHistory = [];
            snapshot.forEach((doc) => withdrawHistory.push({ id: doc.id, ...doc.data() }));
            withdrawHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            updateUI();
        });
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

function updateUI(filteredHistory = null) {
    const tbody = document.getElementById('stockTableBody');
    const select = document.getElementById('withdrawSelect');
    if(!tbody || !select) return; 

    tbody.innerHTML = '';
    select.innerHTML = '<option value="">-- กรุณาเลือกสินค้า --</option>';

    let totalVal = 0, chartLabels = [], chartData = [];

    products.forEach(p => {
        const pQty = p.qty || 0, pPrice = p.price || 0, pCode = p.code || '-', pName = p.name || 'ไม่ระบุ';

        totalVal += (pQty * pPrice);
        chartLabels.push(pName); chartData.push(pQty);

        const imgTag = p.image ? `<img src="${p.image}" class="w-10 h-10 rounded-lg object-cover shadow-sm">` : `<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><i class="fas fa-image"></i></div>`;
        
        // เพิ่มปุ่มแก้ไข (Edit) ติดกับปุ่มลบ (Delete)
        tbody.innerHTML += `
            <tr class="hover:bg-indigo-50/50 transition-colors border-b border-gray-50">
                <td class="p-4">${imgTag}</td>
                <td class="p-4 font-medium text-gray-900">${pCode}</td>
                <td class="p-4">${pName}</td>
                <td class="p-4 ${pQty < 10 ? 'text-red-600 font-bold bg-red-50 rounded-lg px-2 py-1 inline-block mt-2' : 'text-gray-600'}">${pQty.toLocaleString()}</td>
                <td class="p-4 text-gray-600">฿${pPrice.toLocaleString()}</td>
                <td class="p-4 text-center whitespace-nowrap">
                    <button class="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition mr-2" title="แก้ไข" onclick="window.openEditModal('${p.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-500 hover:bg-red-100 p-2 rounded-lg transition" title="ลบ" onclick="window.deleteProduct('${p.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        if(pQty > 0) select.innerHTML += `<option value="${p.id}">${pCode} - ${pName} (คงเหลือ: ${pQty})</option>`;
    });

    document.getElementById('totalItemsDisplay').innerText = products.length.toLocaleString();
    document.getElementById('totalValueDisplay').innerText = totalVal.toLocaleString();

    const chartCanvas = document.getElementById('stockChart');
    if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        if(myChart) myChart.destroy();
        myChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: chartLabels, datasets: [{ label: 'จำนวนสินค้าคงเหลือ', data: chartData, backgroundColor: '#6366f1', borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const historyToRender = filteredHistory || withdrawHistory;
    const trackList = document.getElementById('trackingList');
    if(!trackList) return;

    trackList.innerHTML = '';
    if(historyToRender.length === 0) {
        trackList.innerHTML = '<div class="text-gray-400 text-sm text-center py-8">ไม่มีประวัติการทำรายการ</div>';
    } else {
        historyToRender.forEach(h => {
            trackList.innerHTML += `
                <div class="p-4 border border-gray-100 rounded-xl bg-white shadow-sm flex justify-between items-center mb-3">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-md font-bold">สำเร็จ</span>
                            <span class="text-sm font-semibold text-gray-800">${h.docId}</span>
                        </div>
                        <p class="text-sm text-gray-700">เบิก: <strong>${h.itemName || '-'}</strong> <span class="text-indigo-600 font-bold">(${h.qty} ชิ้น)</span></p>
                        <p class="text-xs text-gray-400 mt-1">${h.note || '-'} | ${h.date}</p>
                    </div>
                    <button onclick="window.printPDF('${h.docId}', '${h.itemName}', '${h.code}', '${h.qty}', '${h.note}', '${h.date}')" class="text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white p-3 rounded-xl transition-all">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            `;
        });
    }
}

// ==========================================
// ส่วนที่ 4: จัดการข้อมูล (เพิ่ม, แก้ไข, เบิก, ลบ)
// ==========================================

// 1. เพิ่มสินค้า
document.getElementById('addBtn').addEventListener('click', async () => {
    const codeVal = document.getElementById('itemCode').value.trim() || "-";
    const nameVal = document.getElementById('itemName').value.trim();
    const qtyVal = Number(document.getElementById('itemQty').value) || 0;
    const priceVal = Number(document.getElementById('itemPrice').value) || 0;
    const fileInput = document.getElementById('itemImage');
    
    if(!nameVal) return alert("กรุณากรอกชื่อสินค้า");

    const btn = document.getElementById('addBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    let base64Image = '';
    if(fileInput.files.length > 0) base64Image = await getBase64(fileInput.files[0]);

    try {
        await addDoc(collection(db, "products"), { code: codeVal, name: nameVal, qty: qtyVal, price: priceVal, image: base64Image });
        ['itemCode', 'itemName', 'itemQty', 'itemPrice', 'itemImage'].forEach(id => document.getElementById(id).value = '');
        alert('เพิ่มสินค้าเรียบร้อยแล้ว');
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }

    btn.innerHTML = '<i class="fas fa-save"></i> บันทึกข้อมูล'; btn.disabled = false;
});

// 2. เบิกสินค้า
document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const id = document.getElementById('withdrawSelect').value;
    const qty = Number(document.getElementById('withdrawQty').value);
    const note = document.getElementById('withdrawNote').value.trim() || 'ไม่ระบุ';

    if(!id || qty <= 0) return alert('กรุณาเลือกและระบุจำนวนให้ถูกต้อง');
    const product = products.find(p => p.id === id);
    if(product.qty < qty) return alert(`สต็อกไม่พอ! (มี ${product.qty})`);

    const btn = document.getElementById('withdrawBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        await updateDoc(doc(db, "products", id), { qty: product.qty - qty });

        const docId = 'DOC-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        
        await addDoc(collection(db, "withdraw_history"), { docId, itemName: product.name, code: product.code, qty, note, date: dateStr, timestamp: Date.now() });

        document.getElementById('withdrawQty').value = '';
        document.getElementById('withdrawNote').value = '';
        
        if(confirm('✅ เบิกสำเร็จ! ต้องการพิมพ์ PDF หรือไม่?')) window.printPDF(docId, product.name, product.code, qty, note, dateStr);
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }

    btn.innerHTML = '<i class="fas fa-check-circle"></i> ยืนยันการเบิก'; btn.disabled = false;
});

// 3. บันทึกการแก้ไข (ฟังก์ชันใหม่)
document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const id = document.getElementById('editItemId').value;
    const code = document.getElementById('editItemCode').value.trim() || "-";
    const name = document.getElementById('editItemName').value.trim();
    const qty = Number(document.getElementById('editItemQty').value) || 0;
    const price = Number(document.getElementById('editItemPrice').value) || 0;
    const fileInput = document.getElementById('editItemImage');

    if(!name) return alert("กรุณากรอกชื่อสินค้า");

    const btn = document.getElementById('saveEditBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...'; btn.disabled = true;

    try {
        let updateData = { code, name, qty, price };
        
        // ถ้ามีการเลือกรูปใหม่ ให้แปลงและอัปเดต ถ้าไม่มีจะคงรูปเดิมไว้
        if (fileInput.files.length > 0) {
            updateData.image = await getBase64(fileInput.files[0]);
        }

        await updateDoc(doc(db, "products", id), updateData);
        window.closeEditModal(); // ปิดหน้าต่าง
        alert('บันทึกการแก้ไขเรียบร้อยแล้ว');
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการอัปเดต: ' + e.message);
    }

    btn.innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข'; btn.disabled = false;
});

// ==========================================
// ส่วนที่ 5: Global Window Functions (HTML เรียกใช้)
// ==========================================

// เปิดหน้าต่างแก้ไข
window.openEditModal = function(id) {
    const product = products.find(p => p.id === id);
    if(!product) return;

    // เติมข้อมูลเดิมลงในช่องกรอก
    document.getElementById('editItemId').value = product.id;
    document.getElementById('editItemCode').value = product.code || '';
    document.getElementById('editItemName').value = product.name || '';
    document.getElementById('editItemQty').value = product.qty || 0;
    document.getElementById('editItemPrice').value = product.price || 0;
    document.getElementById('editItemImage').value = ''; // รีเซ็ตช่องไฟล์

    // แสดงหน้าต่าง
    document.getElementById('editModal').classList.remove('hidden');
};

// ปิดหน้าต่างแก้ไข
window.closeEditModal = function() {
    document.getElementById('editModal').classList.add('hidden');
};

// ลบสินค้า
window.deleteProduct = async function(id) {
    if(confirm('⚠️ ยืนยันการลบสินค้านี้?')) {
        try { await deleteDoc(doc(db, "products", id)); } 
        catch (e) { alert("ลบไม่สำเร็จ"); }
    }
};

// ค้นหาวันที่เบิก (รวบยอดฟังก์ชัน)
document.getElementById('searchDateBtn').addEventListener('click', () => {
    const s = document.getElementById('startDate').value, e = document.getElementById('endDate').value;
    if(s && e) {
        const start = new Date(s).setHours(0,0,0,0), end = new Date(e).setHours(23,59,59,999);
        updateUI(withdrawHistory.filter(h => h.timestamp >= start && h.timestamp <= end));
    } else alert("เลือกวันที่ให้ครบ");
});
document.getElementById('clearSearchBtn').addEventListener('click', () => {
    document.getElementById('startDate').value = ''; document.getElementById('endDate').value = ''; updateUI();
});

// ปริ้น PDF
window.printPDF = function(id, name, code, qty, user, date) {
    document.getElementById('pdfDocId').innerText = id; document.getElementById('pdfUser').innerText = user;
    document.getElementById('pdfDate').innerText = date; document.getElementById('pdfItemCode').innerText = code;
    document.getElementById('pdfItemName').innerText = name; document.getElementById('pdfItemQty').innerText = qty;
    
    const el = document.getElementById('pdfTemplate'); el.classList.remove('hidden');
    html2pdf().set({ margin: 10, filename: `ใบเบิก_${id}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(el).save().then(() => el.classList.add('hidden'));
};
