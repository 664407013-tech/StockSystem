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
let unsubscribeProducts = null, unsubscribeHistory = null, unsubscribeAddHistory = null;

// ==========================================
// 1. ระบบ Authentication
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
        if (unsubscribeAddHistory) unsubscribeAddHistory();
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
    if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) signOut(auth);
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

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result); reader.onerror = error => reject(error);
    });
}

// ==========================================
// 2. ดึงข้อมูลจาก Firestore
// ==========================================
function loadData() {
    try {
        // ดึงสต็อกปัจจุบัน
        unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
            products = [];
            snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
            updateStockTable();
            updateDashboard();
        });

        // ดึงประวัติการเบิกออก
        unsubscribeHistory = onSnapshot(collection(db, "withdraw_history"), (snapshot) => {
            withdrawHistory = [];
            snapshot.forEach((doc) => withdrawHistory.push({ id: doc.id, ...doc.data() }));
            withdrawHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            updateWithdrawList();
            updateDashboard();
        });

        // ดึงประวัติการรับเข้า
        unsubscribeAddHistory = onSnapshot(collection(db, "add_history"), (snapshot) => {
            addHistory = [];
            snapshot.forEach((doc) => addHistory.push({ id: doc.id, ...doc.data() }));
            addHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            updateDashboard();
        });
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// ==========================================
// 3. จัดการ Dashboard (ระบบวิเคราะห์)
// ==========================================
function updateDashboard() {
    let totalItems = products.length;
    let totalValue = products.reduce((sum, p) => sum + ((p.qty || 0) * (p.price || 0)), 0);
    
    document.getElementById('dashCurrentItems').innerText = totalItems.toLocaleString();
    document.getElementById('dashCurrentValue').innerText = `฿${totalValue.toLocaleString()}`;

    const startDateVal = document.getElementById('dashStartDate').value;
    const endDateVal = document.getElementById('dashEndDate').value;
    
    let filteredAdd = addHistory;
    let filteredWith = withdrawHistory;
    let dateRangeText = "ทั้งหมดตั้งแต่เริ่มระบบ";

    if (startDateVal && endDateVal) {
        const start = new Date(startDateVal).setHours(0,0,0,0);
        const end = new Date(endDateVal).setHours(23,59,59,999);
        filteredAdd = addHistory.filter(h => h.timestamp >= start && h.timestamp <= end);
        filteredWith = withdrawHistory.filter(h => h.timestamp >= start && h.timestamp <= end);
        dateRangeText = `${new Date(startDateVal).toLocaleDateString('th-TH')} ถึง ${new Date(endDateVal).toLocaleDateString('th-TH')}`;
    }

    let addedQty = filteredAdd.reduce((sum, h) => sum + (h.qty || 0), 0);
    let withQty = filteredWith.reduce((sum, h) => sum + (h.qty || 0), 0);

    document.getElementById('dashAddedPeriod').innerHTML = `${addedQty.toLocaleString()} <span class="text-sm font-normal text-blue-500">ชิ้น</span>`;
    document.getElementById('dashAddedCount').innerText = `จาก ${filteredAdd.length} รายการ`;
    
    document.getElementById('dashWithdrawnPeriod').innerHTML = `${withQty.toLocaleString()} <span class="text-sm font-normal text-orange-500">ชิ้น</span>`;
    document.getElementById('dashWithdrawnCount').innerText = `จาก ${filteredWith.length} รายการ`;

    const totalMove = addedQty + withQty;
    const barIn = document.getElementById('ratioBarIn');
    const ratioText = document.getElementById('ratioText');
    const statusText = document.getElementById('dashboardStatusText');
    
    if (totalMove === 0) {
        barIn.style.width = '50%';
        ratioText.innerText = "0% / 0%";
        statusText.innerHTML = `ช่วงเวลา <strong>${dateRangeText}</strong><br>ยังไม่มีการเคลื่อนไหวของสต็อก`;
    } else {
        const inPercent = Math.round((addedQty / totalMove) * 100);
        const outPercent = 100 - inPercent;
        barIn.style.width = `${inPercent}%`;
        ratioText.innerText = `${inPercent}% / ${outPercent}%`;
        
        let insight = "สินค้ามีการหมุนเวียนปกติ";
        if (inPercent > 70) insight = "<span class='text-blue-600 font-medium'>มีการนำเข้าสต็อกเป็นจำนวนมากในช่วงเวลานี้</span>";
        else if (outPercent > 70) insight = "<span class='text-orange-600 font-medium'>มีการเบิกสินค้าออกค่อนข้างสูง โปรดระวังของขาดสต็อก</span>";
        
        statusText.innerHTML = `ช่วงเวลา: <strong>${dateRangeText}</strong><br>${insight}`;
    }

    let sortedProducts = [...products].sort((a,b) => b.qty - a.qty).slice(0, 10);
    const chartCanvas = document.getElementById('stockChart');
    if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        if(myChart) myChart.destroy();
        myChart = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: sortedProducts.map(p => p.name || 'ไม่ระบุ'), 
                datasets: [{ label: 'จำนวนคงเหลือ', data: sortedProducts.map(p => p.qty), backgroundColor: '#6366f1', borderRadius: 6 }] 
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

document.getElementById('filterDashBtn').addEventListener('click', () => {
    if (!document.getElementById('dashStartDate').value || !document.getElementById('dashEndDate').value) {
        alert("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบถ้วน"); return;
    }
    updateDashboard();
});
document.getElementById('clearDashBtn').addEventListener('click', () => {
    document.getElementById('dashStartDate').value = '';
    document.getElementById('dashEndDate').value = '';
    updateDashboard();
});

// ==========================================
// 4. การจัดการตารางและการเบิก (Stock & Withdraw UI)
// ==========================================
function updateStockTable() {
    const tbody = document.getElementById('stockTableBody');
    const select = document.getElementById('withdrawSelect');
    if(!tbody || !select) return; 

    tbody.innerHTML = ''; 
    select.innerHTML = '<option value="">-- กรุณาเลือกสินค้า --</option>';

    products.forEach(p => {
        const imgTag = p.image ? `<img src="${p.image}" class="w-10 h-10 rounded-lg object-cover shadow-sm">` : `<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><i class="fas fa-image"></i></div>`;
        
        tbody.innerHTML += `
            <tr class="hover:bg-indigo-50/50 transition-colors border-b border-gray-50">
                <td class="p-4">${imgTag}</td>
                <td class="p-4 font-medium text-gray-900">${p.code || '-'}</td>
                <td class="p-4">${p.name || '-'}</td>
                <td class="p-4 ${p.qty < 10 ? 'text-red-600 font-bold bg-red-50 rounded-lg px-2 py-1 inline-block mt-2' : 'text-gray-600'}">${(p.qty||0).toLocaleString()}</td>
                <td class="p-4 text-gray-600">฿${(p.price||0).toLocaleString()}</td>
                <td class="p-4 text-center whitespace-nowrap">
                    <button class="text-green-600 bg-green-50 hover:bg-green-600 hover:text-white p-2 rounded-lg transition mr-1.5" onclick="window.openRestockModal('${p.id}')" title="เพิ่มสต็อกเข้า"><i class="fas fa-plus-circle"></i></button>
                    <button class="text-blue-500 bg-blue-50 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition mr-1.5" onclick="window.openEditModal('${p.id}')" title="แก้ไขข้อมูล"><i class="fas fa-edit"></i></button>
                    <button class="text-red-500 bg-red-50 hover:bg-red-500 hover:text-white p-2 rounded-lg transition" onclick="window.deleteProduct('${p.id}')" title="ลบสินค้า"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        if((p.qty||0) > 0) select.innerHTML += `<option value="${p.id}">${p.code || '-'} - ${p.name} (คงเหลือ: ${p.qty})</option>`;
    });
}

// ⚠️ ฟังก์ชันแสดงและกรองประวัติการเบิกออก (อัปเกรดใหม่) ⚠️
function updateWithdrawList() {
    const trackList = document.getElementById('trackingList');
    if(!trackList) return;
    trackList.innerHTML = '';
    
    // ดึงค่าจากตัวกรองวันที่
    const startDateVal = document.getElementById('withdrawStartDate')?.value;
    const endDateVal = document.getElementById('withdrawEndDate')?.value;
    let filteredHistory = [...withdrawHistory];

    // คำนวณช่วงเวลาสำหรับการกรอง
    if (startDateVal && endDateVal) {
        const start = new Date(startDateVal).setHours(0,0,0,0);
        const end = new Date(endDateVal).setHours(23,59,59,999);
        filteredHistory = filteredHistory.filter(h => h.timestamp >= start && h.timestamp <= end);
    } else if (startDateVal) {
        // ถ้าเลือกแค่จุดเริ่มต้น ให้แสดงเฉพาะของวันนั้นวันเดียว
        const start = new Date(startDateVal).setHours(0,0,0,0);
        const end = new Date(startDateVal).setHours(23,59,59,999);
        filteredHistory = filteredHistory.filter(h => h.timestamp >= start && h.timestamp <= end);
    }
    
    if(filteredHistory.length === 0) {
        trackList.innerHTML = `
            <div class="text-gray-400 text-sm text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <i class="fas fa-folder-open text-3xl mb-2 block text-gray-300"></i>
                ไม่พบประวัติการเบิกตามช่วงเวลาที่กำหนด
            </div>`;
    } else {
        filteredHistory.forEach(h => {
            trackList.innerHTML += `
                <div class="p-4 border border-gray-100 rounded-xl bg-white shadow-sm flex justify-between items-center mb-3 hover:border-indigo-100 hover:shadow transition-all">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-orange-100 text-orange-700 text-xs px-2.5 py-0.5 rounded-md font-bold">เบิกออก</span>
                            <span class="text-sm font-semibold text-gray-800">${h.docId}</span>
                        </div>
                        <p class="text-sm text-gray-700">เบิก: <strong>${h.itemName || '-'}</strong> <span class="text-orange-600 font-bold">(${h.qty} ชิ้น)</span></p>
                        <p class="text-xs text-gray-400 mt-1"><i class="fas fa-user-edit mr-1"></i>${h.note || '-'} | <i class="fas fa-clock ml-1 mr-1"></i>${h.date}</p>
                    </div>
                    <button onclick="window.printPDF('${h.docId}', '${h.itemName}', '${h.code}', '${h.qty}', '${h.note}', '${h.date}')" class="text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white p-3 rounded-xl transition-all shadow-sm" title="พิมพ์ใบเบิก PDF"><i class="fas fa-print"></i></button>
                </div>
            `;
        });
    }
}

// Event Listeners สำหรับปุ่มกรองและปุ่มล้างค่าในหน้าประวัติการเบิก
document.getElementById('filterWithdrawBtn')?.addEventListener('click', () => {
    if (!document.getElementById('withdrawStartDate').value && !document.getElementById('withdrawEndDate').value) {
        alert("กรุณาเลือกวันที่ที่ต้องการกรอง"); return;
    }
    updateWithdrawList();
});

document.getElementById('clearWithdrawBtn')?.addEventListener('click', () => {
    document.getElementById('withdrawStartDate').value = '';
    document.getElementById('withdrawEndDate').value = '';
    updateWithdrawList();
});

function getFormattedDate() {
    const now = new Date();
    return `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

// ==========================================
// 5. บันทึกข้อมูล (รับเข้าใหม่ / เบิกออก / เพิ่มสต็อกเดิม)
// ==========================================

// 5.1 สร้างสินค้าใหม่เข้าสต็อก (New Product)
document.getElementById('addBtn').addEventListener('click', async () => {
    const code = document.getElementById('itemCode').value.trim() || "-";
    const name = document.getElementById('itemName').value.trim();
    const qty = Number(document.getElementById('itemQty').value) || 0;
    const price = Number(document.getElementById('itemPrice').value) || 0;
    const fileInput = document.getElementById('itemImage');
    
    if(!name) return alert("กรุณากรอกชื่อสินค้า");

    const btn = document.getElementById('addBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    let base64Image = '';
    if(fileInput.files.length > 0) base64Image = await getBase64(fileInput.files[0]);

    try {
        await addDoc(collection(db, "products"), { code, name, qty, price, image: base64Image });
        
        if(qty > 0) {
            await addDoc(collection(db, "add_history"), {
                docId: 'ADD-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
                itemName: name, code: code, qty: qty, 
                date: getFormattedDate(), timestamp: Date.now()
            });
        }

        ['itemCode', 'itemName', 'itemQty', 'itemPrice', 'itemImage'].forEach(id => document.getElementById(id).value = '');
        alert('สร้างรายการสินค้าเข้าสต็อกเรียบร้อยแล้ว');
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }

    btn.innerHTML = '<i class="fas fa-save"></i> บันทึกรายการใหม่'; btn.disabled = false;
});

// 5.2 เบิกสินค้าออก
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

        const docId = 'OUT-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const dateStr = getFormattedDate();
        
        await addDoc(collection(db, "withdraw_history"), { docId, itemName: product.name, code: product.code, qty, note, date: dateStr, timestamp: Date.now() });

        document.getElementById('withdrawQty').value = '';
        document.getElementById('withdrawNote').value = '';
        
        if(confirm('✅ เบิกสำเร็จ! ต้องการพิมพ์ใบเบิก PDF หรือไม่?')) window.printPDF(docId, product.name, product.code, qty, note, dateStr);
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }

    btn.innerHTML = '<i class="fas fa-check-circle"></i> ยืนยันการเบิก'; btn.disabled = false;
});

// 5.3 บันทึกการเพิ่มสต็อกสินค้าเดิม (Restock Existing Item)
document.getElementById('saveRestockBtn').addEventListener('click', async () => {
    const id = document.getElementById('restockItemId').value;
    const code = document.getElementById('restockItemCode').value;
    const name = document.getElementById('restockItemName').value;
    const addQty = Number(document.getElementById('restockQtyInput').value);
    const note = document.getElementById('restockNoteInput').value.trim() || 'รับของเข้าสต็อกเพิ่ม';

    if(!addQty || addQty <= 0) return alert('กรุณาระบุจำนวนที่ต้องการเพิ่มให้ถูกต้อง');

    const product = products.find(p => p.id === id);
    if(!product) return alert('ไม่พบข้อมูลสินค้านี้');

    const btn = document.getElementById('saveRestockBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...'; btn.disabled = true;

    try {
        const newTotalQty = (product.qty || 0) + addQty;
        await updateDoc(doc(db, "products", id), { qty: newTotalQty });

        const docId = 'ADD-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        await addDoc(collection(db, "add_history"), {
            docId: docId,
            itemName: name,
            code: code || '-',
            qty: addQty,
            note: note,
            date: getFormattedDate(),
            timestamp: Date.now()
        });

        window.closeRestockModal();
        alert(`✅ เพิ่มสต็อก "${name}" จำนวน +${addQty} ชิ้น เรียบร้อยแล้ว!\n(ยอดคงเหลือใหม่: ${newTotalQty} ชิ้น)`);
    } catch (e) {
        alert('ข้อผิดพลาดในการบันทึก: ' + e.message);
    }

    btn.innerHTML = '<i class="fas fa-plus"></i> ยืนยันเพิ่มสต็อก'; btn.disabled = false;
});

// 5.4 บันทึกการแก้ไขข้อมูลทั่วไป
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
        if (fileInput.files.length > 0) updateData.image = await getBase64(fileInput.files[0]);
        await updateDoc(doc(db, "products", id), updateData);
        window.closeEditModal();
        alert('บันทึกการแก้ไขเรียบร้อยแล้ว');
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }

    btn.innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข'; btn.disabled = false;
});

// ==========================================
// 6. Global Functions สำหรับเรียกใช้จาก HTML
// ==========================================
window.openRestockModal = function(id) {
    const product = products.find(p => p.id === id);
    if(!product) return;
    document.getElementById('restockItemId').value = product.id;
    document.getElementById('restockItemCode').value = product.code || '';
    document.getElementById('restockItemName').value = product.name || '';
    document.getElementById('restockItemTitle').innerText = `สินค้า: [${product.code || '-'}] ${product.name} (มีอยู่เดิม ${product.qty} ชิ้น)`;
    document.getElementById('restockQtyInput').value = '';
    document.getElementById('restockNoteInput').value = '';
    document.getElementById('restockModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('restockQtyInput').focus(), 100);
};

window.closeRestockModal = () => document.getElementById('restockModal').classList.add('hidden');

window.openEditModal = function(id) {
    const product = products.find(p => p.id === id);
    if(!product) return;
    document.getElementById('editItemId').value = product.id;
    document.getElementById('editItemCode').value = product.code || '';
    document.getElementById('editItemName').value = product.name || '';
    document.getElementById('editItemQty').value = product.qty || 0;
    document.getElementById('editItemPrice').value = product.price || 0;
    document.getElementById('editItemImage').value = ''; 
    document.getElementById('editModal').classList.remove('hidden');
};

window.closeEditModal = () => document.getElementById('editModal').classList.add('hidden');

window.deleteProduct = async (id) => {
    if(confirm('⚠️ ยืนยันการลบสินค้านี้?')) {
        try { await deleteDoc(doc(db, "products", id)); } 
        catch (e) { alert("ลบไม่สำเร็จ"); }
    }
};

window.printPDF = (id, name, code, qty, user, date) => {
    document.getElementById('pdfDocId').innerText = id; document.getElementById('pdfUser').innerText = user;
    document.getElementById('pdfDate').innerText = date; document.getElementById('pdfItemCode').innerText = code;
    document.getElementById('pdfItemName').innerText = name; document.getElementById('pdfItemQty').innerText = qty;
    
    const el = document.getElementById('pdfTemplate'); el.classList.remove('hidden');
    html2pdf().set({ margin: 10, filename: `ใบเบิก_${id}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(el).save().then(() => el.classList.add('hidden'));
};
