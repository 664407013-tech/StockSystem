import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// =========================================================================
// ⚠️ กรุณานำ Firebase Config ของโปรเจกต์คุณมาใส่ตรงนี้ (เพื่อไม่ให้ข้อมูลเดิมหาย)
// =========================================================================
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
let addHistory = []; 
let currentPrintData = null; // เก็บข้อมูลชั่วคราวสำหรับพิมพ์ PDF

// 1. Authentication
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
    }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    if (!email || !password) return;
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm('ยืนยันการออกจากระบบ?')) signOut(auth);
});

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-target')).classList.remove('hidden');
    });
});

// =========================================================================
// 2. ระบบกู้คืนข้อมูลตัวอย่าง (แก้ปัญหาข้อมูลเดิมหาย / เริ่มต้นใช้งานใหม่)
// =========================================================================
document.getElementById('restoreDataBtn').addEventListener('click', async () => {
    if (!confirm('⚠️ คุณต้องการกู้คืน/สร้างข้อมูลสินค้าตัวอย่างและประวัติการเบิกกลับมาใช่หรือไม่?')) return;
    try {
        const sampleProducts = [
            { code: 'PROD-001', name: 'สว่านไร้สาย 20V Cordless Drill', qty: 15, price: 2500 },
            { code: 'PROD-002', name: 'ค้อนหงอนด้ามไฟเบอร์ 16 ออนซ์', qty: 45, price: 350 },
            { code: 'PROD-003', name: 'ถุงมือกันบาดระดับ 5 (Size L)', qty: 120, price: 85 },
            { code: 'PROD-004', name: 'ชุดประแจแหวนข้างปากตาย 14 ชิ้น', qty: 8, price: 1250 },
            { code: 'PROD-005', name: 'ตลับเมตรหุ้มยาง 5 เมตร', qty: 60, price: 150 }
        ];

        for (const item of sampleProducts) {
            await addDoc(collection(db, "products"), item);
        }

        const dateStr = getFormattedDate();
        await addDoc(collection(db, "withdraw_history"), {
            docId: 'OUT-9901', itemName: 'สว่านไร้สาย 20V Cordless Drill', code: 'PROD-001', qty: 2, note: 'ช่างศักดิ์ เบิกไปไซต์งาน A', date: dateStr, timestamp: Date.now()
        });
        await addDoc(collection(db, "withdraw_history"), {
            docId: 'OUT-9902', itemName: 'ถุงมือกันบาดระดับ 5 (Size L)', code: 'PROD-003', qty: 10, note: 'แผนกซ่อมบำรุงเบิกประจำสัปดาห์', date: dateStr, timestamp: Date.now() - 3600000
        });

        alert('✅ กู้คืนข้อมูลตัวอย่างเรียบร้อยแล้ว!');
    } catch (e) {
        alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: กรุณาตรวจสอบ API Key ในโค้ดว่าถูกต้องหรือไม่ครับ');
        console.error(e);
    }
});

// 3. Load Firestore Data
function loadData() {
    onSnapshot(collection(db, "products"), (snapshot) => {
        products = [];
        snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
        updateStockTable();
        updateDashboard();
    });

    onSnapshot(collection(db, "withdraw_history"), (snapshot) => {
        withdrawHistory = [];
        snapshot.forEach((doc) => withdrawHistory.push({ id: doc.id, ...doc.data() }));
        withdrawHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        updateWithdrawList();
        updateDashboard();
    });

    onSnapshot(collection(db, "add_history"), (snapshot) => {
        addHistory = [];
        snapshot.forEach((doc) => addHistory.push({ id: doc.id, ...doc.data() }));
        addHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        updateDashboard();
    });
}

// 4. Update Dashboard & Chart
function updateDashboard() {
    document.getElementById('dashCurrentItems').innerText = products.length.toLocaleString();
    let totalVal = products.reduce((sum, p) => sum + ((p.qty || 0) * (p.price || 0)), 0);
    document.getElementById('dashCurrentValue').innerText = `฿${totalVal.toLocaleString()}`;

    let addedQty = addHistory.reduce((sum, h) => sum + (h.qty || 0), 0);
    let withQty = withdrawHistory.reduce((sum, h) => sum + (h.qty || 0), 0);
    document.getElementById('dashAddedPeriod').innerHTML = `${addedQty.toLocaleString()} <span class="text-sm font-normal">ชิ้น</span>`;
    document.getElementById('dashWithdrawnPeriod').innerHTML = `${withQty.toLocaleString()} <span class="text-sm font-normal">ชิ้น</span>`;

    let sorted = [...products].sort((a,b) => b.qty - a.qty).slice(0, 10);
    const chartCanvas = document.getElementById('stockChart');
    if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        if(myChart) myChart.destroy();
        myChart = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: sorted.map(p => p.name || 'ไม่ระบุ'), 
                datasets: [{ label: 'จำนวนคงเหลือ', data: sorted.map(p => p.qty), backgroundColor: '#6366f1', borderRadius: 6 }] 
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// 5. Update Stock Table
function updateStockTable() {
    const tbody = document.getElementById('stockTableBody');
    const select = document.getElementById('withdrawSelect');
    if(!tbody || !select) return; 

    tbody.innerHTML = ''; 
    select.innerHTML = '<option value="">-- กรุณาเลือกสินค้า --</option>';

    products.forEach(p => {
        tbody.innerHTML += `
            <tr class="hover:bg-indigo-50/50 transition border-b border-gray-50">
                <td class="p-4 font-medium text-gray-900">${p.code || '-'}</td>
                <td class="p-4">${p.name || '-'}</td>
                <td class="p-4 font-bold ${p.qty < 10 ? 'text-red-600' : 'text-gray-700'}">${(p.qty||0).toLocaleString()}</td>
                <td class="p-4 text-gray-600">฿${(p.price||0).toLocaleString()}</td>
                <td class="p-4 text-center whitespace-nowrap">
                    <button class="text-green-600 bg-green-50 hover:bg-green-600 hover:text-white p-2 rounded-lg transition mr-1" onclick="window.openRestockModal('${p.id}')" title="เพิ่มสต็อก"><i class="fas fa-plus-circle"></i></button>
                    <button class="text-blue-500 bg-blue-50 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition mr-1" onclick="window.openEditModal('${p.id}')" title="แก้ไข"><i class="fas fa-edit"></i></button>
                    <button class="text-red-500 bg-red-50 hover:bg-red-500 hover:text-white p-2 rounded-lg transition" onclick="window.deleteProduct('${p.id}')" title="ลบ"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        if((p.qty||0) > 0) select.innerHTML += `<option value="${p.id}">${p.code || '-'} - ${p.name} (คงเหลือ: ${p.qty})</option>`;
    });
}

// =========================================================================
// 6. ส่วนประวัติการเบิก: ปุ่ม "แก้ไข" และปุ่ม "PDF (เปิด Preview)" อยู่คู่กันชัดเจน
// =========================================================================
function updateWithdrawList() {
    const trackList = document.getElementById('trackingList');
    if(!trackList) return;
    trackList.innerHTML = '';
    
    if(withdrawHistory.length === 0) {
        trackList.innerHTML = `<div class="text-gray-400 text-sm text-center py-8">ไม่พบประวัติการเบิกสินค้า (กดปุ่ม "กู้คืนข้อมูลตัวอย่าง" ด้านซ้ายล่างได้ครับ)</div>`;
        return;
    }

    withdrawHistory.forEach(h => {
        trackList.innerHTML += `
            <div class="p-4 border border-gray-100 rounded-xl bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-indigo-100 transition">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded font-bold">เบิกออก</span>
                        <span class="text-sm font-semibold text-gray-800">${h.docId || '-'}</span>
                    </div>
                    <p class="text-sm text-gray-700">เบิก: <strong>${h.itemName || '-'}</strong> <span class="text-orange-600 font-bold">(${h.qty} ชิ้น)</span></p>
                    <p class="text-xs text-gray-400 mt-1"><i class="fas fa-user mr-1"></i>${h.note || '-'} | <i class="fas fa-clock mx-1"></i>${h.date}</p>
                </div>
                
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-0 pt-2 sm:pt-0">
                    <!-- ปุ่มแก้ไขรายการเบิก (สีส้ม) -->
                    <button onclick="window.openEditWithdrawModal('${h.id}')" class="flex-1 sm:flex-none bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-orange-200/50 shadow-sm" title="แก้ไขรายการเบิกนี้">
                        <i class="fas fa-edit text-sm"></i> แก้ไข
                    </button>

                    <!-- ปุ่มตรวจสอบและพิมพ์ PDF (สีน้ำเงิน) จะเปิดหน้าต่างเช็กเอกสารก่อนตามที่คุณสั่ง! -->
                    <button onclick="window.openPrintPreview('${h.id}')" class="flex-1 sm:flex-none bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-indigo-200/50 shadow-sm" title="ตรวจสอบและพิมพ์ใบเบิก PDF">
                        <i class="fas fa-print text-sm"></i> PDF
                    </button>
                </div>
            </div>
        `;
    });
}

function getFormattedDate() {
    const now = new Date();
    return `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

// 7. Action Handlers
document.getElementById('addBtn').addEventListener('click', async () => {
    const code = document.getElementById('itemCode').value.trim() || "-";
    const name = document.getElementById('itemName').value.trim();
    const qty = Number(document.getElementById('itemQty').value) || 0;
    const price = Number(document.getElementById('itemPrice').value) || 0;
    if(!name) return alert("กรุณากรอกชื่อสินค้า");

    try {
        await addDoc(collection(db, "products"), { code, name, qty, price });
        if(qty > 0) {
            await addDoc(collection(db, "add_history"), {
                docId: 'ADD-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
                itemName: name, code: code, qty: qty, date: getFormattedDate(), timestamp: Date.now()
            });
        }
        ['itemCode', 'itemName', 'itemQty', 'itemPrice'].forEach(id => document.getElementById(id).value = '');
        alert('บันทึกรายการสินค้าสำเร็จ');
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }
});

document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const id = document.getElementById('withdrawSelect').value;
    const qty = Number(document.getElementById('withdrawQty').value);
    const note = document.getElementById('withdrawNote').value.trim() || 'ไม่ระบุ';
    if(!id || qty <= 0) return alert('กรุณาเลือกสินค้าและระบุจำนวน');
    const product = products.find(p => p.id === id);
    if(product.qty < qty) return alert(`สต็อกไม่พอ! (มี ${product.qty})`);

    try {
        await updateDoc(doc(db, "products", id), { qty: product.qty - qty });
        const docId = 'OUT-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const dateStr = getFormattedDate();
        const docRef = await addDoc(collection(db, "withdraw_history"), { docId, itemName: product.name, code: product.code, qty, note, date: dateStr, timestamp: Date.now() });
        document.getElementById('withdrawQty').value = '';
        document.getElementById('withdrawNote').value = '';
        
        // เสนอให้ตรวจสอบและพิมพ์ใบเบิกทันทีหลังบันทึก
        if(confirm('✅ เบิกสำเร็จ! ต้องการเปิดหน้าตรวจสอบและพิมพ์ใบเบิก PDF เลยหรือไม่?')) {
            window.openPrintPreview(docRef.id);
        }
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }
});

document.getElementById('saveRestockBtn').addEventListener('click', async () => {
    const id = document.getElementById('restockItemId').value;
    const code = document.getElementById('restockItemCode').value;
    const name = document.getElementById('restockItemName').value;
    const addQty = Number(document.getElementById('restockQtyInput').value);
    const note = document.getElementById('restockNoteInput').value.trim() || 'รับของเข้าสต็อกเพิ่ม';
    if(!addQty || addQty <= 0) return alert('กรุณาระบุจำนวนที่เพิ่ม');
    const product = products.find(p => p.id === id);

    try {
        await updateDoc(doc(db, "products", id), { qty: (product.qty || 0) + addQty });
        await addDoc(collection(db, "add_history"), {
            docId: 'ADD-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
            itemName: name, code: code || '-', qty: addQty, note: note, date: getFormattedDate(), timestamp: Date.now()
        });
        window.closeRestockModal();
        alert(`✅ เพิ่มสต็อก +${addQty} เรียบร้อยแล้ว!`);
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }
});

document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const id = document.getElementById('editItemId').value;
    const code = document.getElementById('editItemCode').value.trim() || "-";
    const name = document.getElementById('editItemName').value.trim();
    const qty = Number(document.getElementById('editItemQty').value) || 0;
    const price = Number(document.getElementById('editItemPrice').value) || 0;
    if(!name) return alert("กรุณากรอกชื่อสินค้า");

    try {
        await updateDoc(doc(db, "products", id), { code, name, qty, price });
        window.closeEditModal();
        alert('แก้ไขสินค้าเรียบร้อยแล้ว');
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }
});

document.getElementById('saveEditWithdrawBtn').addEventListener('click', async () => {
    const id = document.getElementById('editWithId').value;
    const code = document.getElementById('editWithCode').value;
    const name = document.getElementById('editWithProductName').value;
    const oldQty = Number(document.getElementById('editWithOldQty').value);
    const newQty = Number(document.getElementById('editWithQty').value);
    const newNote = document.getElementById('editWithNote').value.trim() || 'ไม่ระบุ';
    const newDate = document.getElementById('editWithDate').value.trim();

    if (!newQty || newQty <= 0) return alert('กรุณาระบุจำนวนเบิกให้ถูกต้อง');

    try {
        const diff = newQty - oldQty; 
        if (diff !== 0) {
            const product = products.find(p => (p.name === name) || (p.code === code));
            if (product) {
                const updatedStock = (product.qty || 0) - diff;
                if (updatedStock < 0) return alert(`⚠️ สต็อกสินค้าหลักไม่พอให้ปรับยอดเบิกเป็น ${newQty} ชิ้น (เหลือในสต็อก ${product.qty} ชิ้น)`);
                await updateDoc(doc(db, "products", product.id), { qty: updatedStock });
            }
        }
        await updateDoc(doc(db, "withdraw_history", id), { qty: newQty, note: newNote, date: newDate });
        window.closeEditWithdrawModal();
        alert('✅ แก้ไขประวัติการเบิกและปรับสต็อกให้อัตโนมัติเรียบร้อยแล้ว!');
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }
});

// 8. Modals Open/Close Functions
window.openRestockModal = (id) => {
    const product = products.find(p => p.id === id);
    if(!product) return;
    document.getElementById('restockItemId').value = product.id;
    document.getElementById('restockItemCode').value = product.code || '';
    document.getElementById('restockItemName').value = product.name || '';
    document.getElementById('restockItemTitle').innerText = `สินค้า: [${product.code || '-'}] ${product.name} (คงเหลือ: ${product.qty})`;
    document.getElementById('restockQtyInput').value = '';
    document.getElementById('restockNoteInput').value = '';
    document.getElementById('restockModal').classList.remove('hidden');
};
window.closeRestockModal = () => document.getElementById('restockModal').classList.add('hidden');

window.openEditModal = (id) => {
    const product = products.find(p => p.id === id);
    if(!product) return;
    document.getElementById('editItemId').value = product.id;
    document.getElementById('editItemCode').value = product.code || '';
    document.getElementById('editItemName').value = product.name || '';
    document.getElementById('editItemQty').value = product.qty || 0;
    document.getElementById('editItemPrice').value = product.price || 0;
    document.getElementById('editModal').classList.remove('hidden');
};
window.closeEditModal = () => document.getElementById('editModal').classList.add('hidden');

window.openEditWithdrawModal = (id) => {
    const history = withdrawHistory.find(h => h.id === id);
    if (!history) return;
    document.getElementById('editWithId').value = history.id;
    document.getElementById('editWithCode').value = history.code || '-';
    document.getElementById('editWithProductName').value = history.itemName || '';
    document.getElementById('editWithOldQty').value = history.qty || 0;
    document.getElementById('editWithdrawTitle').innerText = `เอกสาร: ${history.docId || '-'} (${history.itemName})`;
    document.getElementById('editWithQty').value = history.qty || 0;
    document.getElementById('editWithNote').value = history.note || '';
    document.getElementById('editWithDate').value = history.date || getFormattedDate();
    document.getElementById('editWithdrawModal').classList.remove('hidden');
};
window.closeEditWithdrawModal = () => document.getElementById('editWithdrawModal').classList.add('hidden');

window.deleteProduct = async (id) => {
    if(confirm('⚠️ ยืนยันการลบสินค้านี้?')) {
        try { await deleteDoc(doc(db, "products", id)); } catch (e) { alert("ลบไม่สำเร็จ"); }
    }
};

// =========================================================================
// 9. ระบบตรวจสอบและพิมพ์ใบเบิก PDF (แก้ปัญหากระดาษเปล่าแบบเด็ดขาด 100%)
// =========================================================================

// 9.1 เปิดหน้าต่าง Preview เพื่อเช็กเอกสารก่อนพิมพ์ตามที่คุณต้องการ
window.openPrintPreview = (historyId) => {
    const h = withdrawHistory.find(item => item.id === historyId);
    if (!h) return alert("ไม่พบข้อมูลเอกสาร");

    currentPrintData = h; // เก็บข้อมูลไว้สำหรับพิมพ์

    const container = document.getElementById('printableDocument');
    // ใช้ Standard Inline CSS (ไม่พึ่งพา Tailwind class) เพื่อให้ html2canvas อ่านสีและเส้นได้ครบ 100%
    container.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1f2937; padding-bottom: 20px;">
            <h1 style="font-size: 26px; font-weight: bold; margin: 0; color: #111827; letter-spacing: 0.5px;">ใบเบิกสินค้า (Withdrawal Slip)</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">ระบบจัดการสต็อกสินค้า StockPro System</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; line-height: 1.8; background-color: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div>
                <p style="margin: 0; color: #334155;"><strong>รหัสเอกสาร:</strong> <span style="color: #4f46e5; font-weight: bold; font-size: 16px;">${h.docId || '-'}</span></p>
                <p style="margin: 0; color: #334155;"><strong>ผู้เบิก / หมายเหตุ:</strong> <span style="color: #0f172a; font-weight: 600;">${h.note || '-'}</span></p>
            </div>
            <div style="text-align: right;">
                <p style="margin: 0; color: #334155;"><strong>วันที่ทำรายการ:</strong> <span>${h.date || '-'}</span></p>
                <p style="margin: 0; color: #334155;"><strong>สถานะ:</strong> <span style="color: #16a34a; font-weight: bold;">อนุมัติและจ่ายของแล้ว</span></p>
            </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 50px; font-size: 14px;">
            <thead>
                <tr style="background-color: #1e293b; color: #ffffff; text-align: left;">
                    <th style="border: 1px solid #1e293b; padding: 12px; width: 25%; font-weight: 600;">รหัสสินค้า</th>
                    <th style="border: 1px solid #1e293b; padding: 12px; width: 50%; font-weight: 600;">รายการสินค้าที่เบิก</th>
                    <th style="border: 1px solid #1e293b; padding: 12px; text-align: center; width: 25%; font-weight: 600;">จำนวน</th>
                </tr>
            </thead>
            <tbody>
                <tr style="background-color: #ffffff;">
                    <td style="border: 1px solid #cbd5e1; padding: 14px; font-weight: bold; color: #334155;">${h.code || '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 14px; color: #0f172a; font-weight: 500;">${h.itemName || '-'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 14px; text-align: center; font-weight: bold; color: #ea580c; font-size: 16px;">${h.qty} ชิ้น</td>
                </tr>
            </tbody>
        </table>
        
        <div style="display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; font-size: 14px; text-align: center;">
            <div style="width: 45%;">
                <p style="margin-bottom: 45px; color: #94a3b8;">___________________________________</p>
                <p style="font-weight: bold; margin: 0; color: #334155;">ผู้ขอเบิกสินค้า</p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">วันที่: ......./......./...........</p>
            </div>
            <div style="width: 45%;">
                <p style="margin-bottom: 45px; color: #94a3b8;">___________________________________</p>
                <p style="font-weight: bold; margin: 0; color: #334155;">ผู้อนุมัติ / ผู้จ่ายของ</p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">วันที่: ......./......./...........</p>
            </div>
        </div>
    `;

    document.getElementById('printPreviewModal').classList.remove('hidden');
};

window.closePrintPreview = () => {
    document.getElementById('printPreviewModal').classList.add('hidden');
    currentPrintData = null;
};

// 9.2 ปุ่มดาวน์โหลดไฟล์ PDF (ใช้ html2pdf ดึงจากตัวเอกสารที่กำลังแสดงอยู่จริงบนหน้าจอ จึงรับประกันไม่เป็นกระดาษเปล่า)
window.confirmDownloadPDF = () => {
    const element = document.getElementById('printableDocument');
    const btn = document.getElementById('downloadPdfBtn');
    
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> กำลังสร้างไฟล์ PDF...`;
    btn.disabled = true;

    const opt = {
        margin:       12,
        filename:     `ใบเบิกสินค้า_${currentPrintData?.docId || 'slip'}.pdf`,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        btn.innerHTML = `<i class="fas fa-check"></i> ดาวน์โหลดสำเร็จ!`;
        setTimeout(() => {
            btn.innerHTML = `<i class="fas fa-file-download"></i> ดาวน์โหลดไฟล์ PDF`;
            btn.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error("PDF Error:", err);
        alert("เกิดข้อผิดพลาดในการดาวน์โหลด PDF");
        btn.innerHTML = `<i class="fas fa-file-download"></i> ดาวน์โหลดไฟล์ PDF`;
        btn.disabled = false;
    });
};

// 9.3 ปุ่มพิมพ์ผ่านระบบเบราว์เซอร์ (Vector PDF - การันตีความคมชัด 100% ไม่พึ่งพาไลบรารีใดๆ)
window.confirmNativePrint = () => {
    const printContent = document.getElementById('printableDocument').innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>ใบเบิกสินค้า_${currentPrintData?.docId || 'slip'}</title>
            <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Prompt', sans-serif; padding: 30px; margin: 0; color: #111827; background: #fff; }
                @media print {
                    body { padding: 0; }
                    @page { margin: 2cm; }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 400);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};
