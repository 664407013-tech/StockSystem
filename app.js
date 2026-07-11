import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// ⚠️ เปลี่ยน Config ของคุณตรงนี้ ⚠️
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
let addHistory = []; 

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

// 2. Load Firestore Data
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

// 3. Update Dashboard & Chart
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

// 4. Update Stock Table
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
// 5. จุดสำคัญ: ประวัติการเบิก มีปุ่ม "แก้ไข" อยู่ข้างๆปุ่ม "ปริ้น PDF" อย่างเด่นชัด
// =========================================================================
function updateWithdrawList() {
    const trackList = document.getElementById('trackingList');
    if(!trackList) return;
    trackList.innerHTML = '';
    
    if(withdrawHistory.length === 0) {
        trackList.innerHTML = `<div class="text-gray-400 text-sm text-center py-8">ไม่พบประวัติการเบิกสินค้า</div>`;
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
                
                <!-- ปุ่มทั้ง 2 ปุ่มอยู่คู่กันตรงนี้เลยครับ -->
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-0 pt-2 sm:pt-0">
                    
                    <!-- ปุ่ม 1: แก้ไขประวัติการเบิก (สีส้ม) -->
                    <button onclick="window.openEditWithdrawModal('${h.id}')" class="flex-1 sm:flex-none bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-orange-200/50 shadow-sm" title="แก้ไขรายการเบิกนี้">
                        <i class="fas fa-edit text-sm"></i> แก้ไข
                    </button>

                    <!-- ปุ่ม 2: ปริ้นเอกสาร PDF (สีน้ำเงิน) -->
                    <button onclick="window.printPDF('${h.docId}', '${h.itemName}', '${h.code}', '${h.qty}', '${h.note}', '${h.date}')" class="flex-1 sm:flex-none bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-indigo-200/50 shadow-sm" title="พิมพ์ใบเบิก PDF">
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

// 6. Action Handlers
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
        await addDoc(collection(db, "withdraw_history"), { docId, itemName: product.name, code: product.code, qty, note, date: dateStr, timestamp: Date.now() });
        document.getElementById('withdrawQty').value = '';
        document.getElementById('withdrawNote').value = '';
        if(confirm('✅ เบิกสำเร็จ! ต้องการพิมพ์ใบเบิก PDF เลยหรือไม่?')) window.printPDF(docId, product.name, product.code, qty, note, dateStr);
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }
});

// บันทึกแก้ไขสต็อกเพิ่ม
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

// บันทึกแก้ไขข้อมูลสินค้า
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

// บันทึกแก้ไขประวัติการเบิก (ตัดสต็อก/คืนสต็อกอัตโนมัติ)
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

// 7. Modals Open/Close Functions
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
// 8. จุดแก้ปัญหาใหญ่: ระบบปริ้น PDF (ใช้ Dynamic DOM ลาขาดปัญหากระดาษเปล่า)
// =========================================================================
window.printPDF = (id, name, code, qty, user, date) => {
    // 1. สร้าง div ชั่วคราวขึ้นมาบน DOM สดๆ เพื่อให้ html2canvas จับภาพได้ 100% ไม่ติดปัญหาซ่อนหรือพิกัดผิด
    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.top = '0';
    printContainer.style.left = '0';
    printContainer.style.width = '800px';
    printContainer.style.backgroundColor = '#ffffff';
    printContainer.style.padding = '40px';
    printContainer.style.color = '#1f2937';
    printContainer.style.fontFamily = "'Prompt', sans-serif";
    printContainer.style.zIndex = '999999';
    
    printContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1f2937; padding-bottom: 20px;">
            <h1 style="font-size: 26px; font-weight: bold; margin: 0; color: #111827;">ใบเบิกสินค้า (Withdrawal Slip)</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">ระบบจัดการสต็อกสินค้า StockPro System</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; line-height: 1.8;">
            <div>
                <p style="margin: 0;"><strong>รหัสเอกสาร:</strong> <span style="color: #4f46e5; font-weight: bold;">${id || '-'}</span></p>
                <p style="margin: 0;"><strong>ผู้เบิก / หมายเหตุ:</strong> <span>${user || '-'}</span></p>
            </div>
            <div style="text-align: right;">
                <p style="margin: 0;"><strong>วันที่เบิก:</strong> <span>${date || '-'}</span></p>
                <p style="margin: 0;"><strong>สถานะ:</strong> <span style="color: #16a34a; font-weight: bold;">อนุมัติเรียบร้อย</span></p>
            </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 14px;">
            <thead>
                <tr style="background-color: #f3f4f6; text-align: left;">
                    <th style="border: 1px solid #d1d5db; padding: 12px; width: 25%;">รหัสสินค้า</th>
                    <th style="border: 1px solid #d1d5db; padding: 12px; width: 50%;">รายการสินค้า</th>
                    <th style="border: 1px solid #d1d5db; padding: 12px; text-align: center; width: 25%;">จำนวนที่เบิก</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="border: 1px solid #d1d5db; padding: 12px; font-weight: bold;">${code || '-'}</td>
                    <td style="border: 1px solid #d1d5db; padding: 12px;">${name || '-'}</td>
                    <td style="border: 1px solid #d1d5db; padding: 12px; text-align: center; font-weight: bold; color: #ea580c;">${qty} ชิ้น</td>
                </tr>
            </tbody>
        </table>
        
        <div style="display: flex; justify-content: space-between; margin-top: 80px; padding-top: 20px; font-size: 14px; text-align: center;">
            <div style="width: 40%;">
                <p style="margin-bottom: 40px;">___________________________________</p>
                <p style="font-weight: bold; margin: 0;">ผู้ขอเบิกสินค้า</p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">วันที่: ......./......./...........</p>
            </div>
            <div style="width: 40%;">
                <p style="margin-bottom: 40px;">___________________________________</p>
                <p style="font-weight: bold; margin: 0;">ผู้อนุมัติ / ผู้จ่ายของ</p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">วันที่: ......./......./...........</p>
            </div>
        </div>
    `;
    
    // เอาโครงสร้างเข้าเบราว์เซอร์
    document.body.appendChild(printContainer);

    // หน่วงเวลา 400 มิลลิวินาที ให้ฟอนต์ Prompt และ Layout จัดเรียงให้สมบูรณ์ก่อนถ่ายภาพ
    setTimeout(() => {
        const opt = {
            margin:       10,
            filename:     `ใบเบิกสินค้า_${id || 'slip'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // สั่งสร้างไฟล์ PDF จากนั้นลบ DOM ชั่วคราวออกไป
        html2pdf().set(opt).from(printContainer).save().then(() => {
            if (document.body.contains(printContainer)) {
                document.body.removeChild(printContainer);
            }
        }).catch(err => {
            console.error("PDF Error:", err);
            alert("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF");
            if (document.body.contains(printContainer)) {
                document.body.removeChild(printContainer);
            }
        });
    }, 400);
};
