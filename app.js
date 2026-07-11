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
let currentPrintData = {}; 

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
    catch (error) { 
        const errorMsg = document.getElementById('loginError');
        if(errorMsg) errorMsg.classList.remove('hidden');
        else alert("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); 
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) signOut(auth);
});

// ==========================================
// 🌟 1.1 ระบบควบคุม Responsive Sidebar (เพิ่มใหม่ให้รองรับ มือถือ/แท็บเล็ต) 🌟
// ==========================================
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleSidebar(show) {
    if(!sidebar || !sidebarOverlay) return;
    if (show) {
        sidebar.classList.add('show');
        sidebarOverlay.classList.remove('hidden');
    } else {
        sidebar.classList.remove('show');
        sidebarOverlay.classList.add('hidden');
    }
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => toggleSidebar(true));
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

// Navigation & ปิด Sidebar อัตโนมัติเมื่อเลือกเมนูบนหน้าจอมือถือ
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-target')).classList.remove('hidden');
        
        // ถ้าหน้าจอเล็กกว่า 768px ให้ปิด Sidebar อัตโนมัติหลังกดเมนู
        if (window.innerWidth <= 768) toggleSidebar(false);
    });
});

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result); reader.onerror = error => reject(error);
    });
}

function findProductForHistory(item) {
    return products.find(p => p.id === item.productId) || 
           products.find(p => p.code !== '-' && p.code === item.code) || 
           products.find(p => p.name === item.itemName);
}

// ==========================================
// 2. ดึงข้อมูลจาก Firestore
// ==========================================
function loadData() {
    try {
        unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
            products = [];
            snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
            updateStockTable();
            updateDashboard();
        });

        unsubscribeHistory = onSnapshot(collection(db, "withdraw_history"), (snapshot) => {
            withdrawHistory = [];
            snapshot.forEach((doc) => withdrawHistory.push({ id: doc.id, ...doc.data() }));
            withdrawHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            updateWithdrawList();
            updateDashboard();
        });

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
// 3. จัดการ Dashboard (ระบบวิเคราะห์ + กราฟ Responsive)
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

    document.getElementById('dashAddedPeriod').innerHTML = `${addedQty.toLocaleString()} <span class="text-xs sm:text-sm font-normal text-blue-500">ชิ้น</span>`;
    document.getElementById('dashAddedCount').innerText = `จาก ${filteredAdd.length} รายการ`;
    
    document.getElementById('dashWithdrawnPeriod').innerHTML = `${withQty.toLocaleString()} <span class="text-xs sm:text-sm font-normal text-orange-500">ชิ้น</span>`;
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
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { font: { size: window.innerWidth < 640 ? 10 : 12 } } },
                    y: { ticks: { font: { size: window.innerWidth < 640 ? 10 : 12 } } }
                }
            }
        });
    }
}

// อัปเดตขนาด Chart เมื่อผู้ใช้หมุนจอหรือปรับขนาดจอ
window.addEventListener('resize', () => {
    if(myChart) myChart.resize();
});

document.getElementById('filterDashBtn')?.addEventListener('click', () => {
    if (!document.getElementById('dashStartDate').value || !document.getElementById('dashEndDate').value) {
        alert("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบถ้วน"); return;
    }
    updateDashboard();
});
document.getElementById('clearDashBtn')?.addEventListener('click', () => {
    document.getElementById('dashStartDate').value = '';
    document.getElementById('dashEndDate').value = '';
    updateDashboard();
});

// ==========================================
// 4. การจัดการตารางและการเบิก
// ==========================================
document.getElementById('productSearchInput')?.addEventListener('input', () => {
    updateStockTable();
});

document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
    const searchInput = document.getElementById('productSearchInput');
    if(searchInput) searchInput.value = '';
    updateStockTable();
});

function updateStockTable() {
    const tbody = document.getElementById('stockTableBody');
    const select = document.getElementById('withdrawSelect');
    const searchInput = document.getElementById('productSearchInput');
    const countText = document.getElementById('searchCountText');
    if(!tbody || !select) return; 

    tbody.innerHTML = ''; 
    select.innerHTML = '<option value="">-- กรุณาเลือกสินค้า --</option>';

    const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filteredProducts = products.filter(p => {
        const matchCode = (p.code || '').toLowerCase().includes(searchQuery);
        const matchName = (p.name || '').toLowerCase().includes(searchQuery);
        return matchCode || matchName;
    });

    if(countText) countText.innerText = filteredProducts.length;

    if(filteredProducts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-gray-400 bg-gray-50/50">
                    <i class="fas fa-box-open text-3xl mb-2 block text-gray-300"></i>
                    ไม่พบรายการสินค้าที่ตรงกับคำค้นหา
                </td>
            </tr>`;
    } else {
        filteredProducts.forEach(p => {
            const imgTag = p.image ? `<img src="${p.image}" class="w-10 h-10 rounded-lg object-cover shadow-sm">` : `<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><i class="fas fa-image"></i></div>`;
            
            let statusBadge = '';
            let qtyClass = 'text-gray-700 font-medium';
            if ((p.qty || 0) === 0) {
                statusBadge = `<span class="ml-1 sm:ml-2 bg-red-100 text-red-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold border border-red-200 inline-flex items-center gap-1"><i class="fas fa-exclamation-circle text-[9px]"></i> สินค้าหมด</span>`;
                qtyClass = 'text-red-600 font-bold';
            } else if ((p.qty || 0) < 10) {
                statusBadge = `<span class="ml-1 sm:ml-2 bg-amber-100 text-amber-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold border border-amber-200 inline-flex items-center gap-1"><i class="fas fa-clock text-[9px]"></i> ใกล้หมด</span>`;
                qtyClass = 'text-amber-600 font-bold';
            } else {
                statusBadge = `<span class="ml-1 sm:ml-2 bg-green-100 text-green-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium border border-green-200 inline-flex items-center gap-1"><i class="fas fa-check-circle text-[9px]"></i> ปกติ</span>`;
            }

            tbody.innerHTML += `
                <tr class="hover:bg-indigo-50/50 transition-colors border-b border-gray-50">
                    <td class="p-3 sm:p-4">${imgTag}</td>
                    <td class="p-3 sm:p-4 font-medium text-gray-900">${p.code || '-'}</td>
                    <td class="p-3 sm:p-4 font-medium text-gray-800">${p.name || '-'}</td>
                    <td class="p-3 sm:p-4 whitespace-nowrap">
                        <span class="${qtyClass} text-sm sm:text-base">${(p.qty||0).toLocaleString()}</span>
                        ${statusBadge}
                    </td>
                    <td class="p-3 sm:p-4 text-gray-600 whitespace-nowrap">฿${(p.price||0).toLocaleString()}</td>
                    <td class="p-3 sm:p-4 text-center whitespace-nowrap">
                        <button class="text-green-600 bg-green-50 hover:bg-green-600 hover:text-white p-2 rounded-lg transition mr-1" onclick="window.openRestockModal('${p.id}')" title="เพิ่มสต็อกเข้า"><i class="fas fa-plus-circle"></i></button>
                        <button class="text-blue-500 bg-blue-50 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition mr-1" onclick="window.openEditModal('${p.id}')" title="แก้ไขข้อมูล"><i class="fas fa-edit"></i></button>
                        <button class="text-red-500 bg-red-50 hover:bg-red-500 hover:text-white p-2 rounded-lg transition" onclick="window.deleteProduct('${p.id}')" title="ลบสินค้า"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    products.forEach(p => {
        if((p.qty||0) > 0) select.innerHTML += `<option value="${p.id}">${p.code || '-'} - ${p.name} (คงเหลือ: ${p.qty})</option>`;
    });
}

function updateWithdrawList() {
    const trackList = document.getElementById('trackingList');
    if(!trackList) return;
    trackList.innerHTML = '';
    
    const startDateVal = document.getElementById('withdrawStartDate')?.value;
    const endDateVal = document.getElementById('withdrawEndDate')?.value;
    let filteredHistory = [...withdrawHistory];

    if (startDateVal && endDateVal) {
        const start = new Date(startDateVal).setHours(0,0,0,0);
        const end = new Date(endDateVal).setHours(23,59,59,999);
        filteredHistory = filteredHistory.filter(h => h.timestamp >= start && h.timestamp <= end);
    } else if (startDateVal) {
        const start = new Date(startDateVal).setHours(0,0,0,0);
        const end = new Date(startDateVal).setHours(23,59,59,999);
        filteredHistory = filteredHistory.filter(h => h.timestamp >= start && h.timestamp <= end);
    }
    
    if(filteredHistory.length === 0) {
        trackList.innerHTML = `
            <div class="text-gray-400 text-xs sm:text-sm text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <i class="fas fa-folder-open text-3xl mb-2 block text-gray-300"></i>
                ไม่พบประวัติการเบิกตามช่วงเวลาที่กำหนด
            </div>`;
    } else {
        filteredHistory.forEach(h => {
            trackList.innerHTML += `
                <div class="p-3 sm:p-4 border border-gray-100 rounded-xl bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 hover:border-indigo-100 hover:shadow transition-all">
                    <div class="flex-1 w-full">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-orange-100 text-orange-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-bold">เบิกออก</span>
                            <span class="text-xs sm:text-sm font-semibold text-gray-800">${h.docId || '-'}</span>
                        </div>
                        <p class="text-xs sm:text-sm text-gray-700">เบิก: <strong>${h.itemName || '-'}</strong> <span class="text-orange-600 font-bold">(${h.qty} ชิ้น)</span></p>
                        <p class="text-[11px] sm:text-xs text-gray-400 mt-1"><i class="fas fa-user-edit mr-1"></i>${h.note || '-'} | <i class="fas fa-clock ml-1 mr-1"></i>${h.date || '-'}</p>
                    </div>
                    <div class="flex items-center justify-end gap-1.5 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                        <button onclick="window.openEditWithdrawModal('${h.id}')" class="flex-1 sm:flex-none text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white p-2 sm:p-3 rounded-xl transition-all shadow-sm text-center" title="แก้ไขรายการเบิก"><i class="fas fa-edit"></i></button>
                        <button onclick="window.deleteWithdraw('${h.id}')" class="flex-1 sm:flex-none text-red-500 bg-red-50 hover:bg-red-500 hover:text-white p-2 sm:p-3 rounded-xl transition-all shadow-sm text-center" title="ลบรายการเบิกและคืนสต็อก"><i class="fas fa-trash"></i></button>
                        <button onclick="window.printPDF('${h.docId}', '${h.itemName}', '${h.code}', '${h.qty}', '${h.note}', '${h.date}')" class="flex-1 sm:flex-none text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white p-2 sm:p-3 rounded-xl transition-all shadow-sm text-center" title="ตรวจสอบและพิมพ์ใบเบิก PDF"><i class="fas fa-print"></i></button>
                    </div>
                </div>
            `;
        });
    }
}

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
document.getElementById('addBtn').addEventListener('click', async () => {
    const code = document.getElementById('itemCode').value.trim() || "-";
    const name = document.getElementById('itemName').value.trim();
    const qty = Number(document.getElementById('itemQty').value) || 0;
    const price = Number(document.getElementById('itemPrice').value) || 0;
    const fileInput = document.getElementById('itemImage');
    
    if(!name) return alert("กรุณากรอกชื่อสินค้า");

    const btn = document.getElementById('addBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...'; btn.disabled = true;

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

document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const id = document.getElementById('withdrawSelect').value;
    const qty = Number(document.getElementById('withdrawQty').value);
    const note = document.getElementById('withdrawNote').value.trim() || 'ไม่ระบุ';

    if(!id || qty <= 0) return alert('กรุณาเลือกและระบุจำนวนให้ถูกต้อง');
    const product = products.find(p => p.id === id);
    if(product.qty < qty) return alert(`สต็อกไม่พอ! (มี ${product.qty})`);

    const btn = document.getElementById('withdrawBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังเบิก...'; btn.disabled = true;

    try {
        await updateDoc(doc(db, "products", id), { qty: product.qty - qty });

        const docId = 'OUT-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const dateStr = getFormattedDate();
        
        await addDoc(collection(db, "withdraw_history"), { 
            productId: id, 
            docId, itemName: product.name, code: product.code, qty, note, date: dateStr, timestamp: Date.now() 
        });

        document.getElementById('withdrawQty').value = '';
        document.getElementById('withdrawNote').value = '';
        
        if(confirm('✅ เบิกสินค้าสำเร็จ! ต้องการเปิดตรวจสอบตัวอย่างใบเบิก เพื่อพิมพ์ PDF หรือไม่?')) {
            window.printPDF(docId, product.name, product.code, qty, note, dateStr);
        }
    } catch (e) { alert('ข้อผิดพลาด: ' + e.message); }

    btn.innerHTML = '<i class="fas fa-check-circle"></i> ยืนยันการเบิก'; btn.disabled = false;
});

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

document.getElementById('saveEditWithdrawBtn').addEventListener('click', async () => {
    const id = document.getElementById('editWithdrawId').value;
    const oldQty = Number(document.getElementById('editWithdrawOldQty').value) || 0;
    const newQty = Number(document.getElementById('editWithdrawQtyInput').value) || 0;
    const newNote = document.getElementById('editWithdrawNoteInput').value.trim() || 'ไม่ระบุ';

    if(newQty <= 0) return alert('กรุณาระบุจำนวนเบิกให้ถูกต้อง (ต้องมากกว่า 0)');

    const item = withdrawHistory.find(h => h.id === id);
    if(!item) return alert('ไม่พบข้อมูลประวัติการเบิก');

    const btn = document.getElementById('saveEditWithdrawBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...'; btn.disabled = true;

    try {
        if(oldQty !== newQty) {
            const product = findProductForHistory(item);
            if(product) {
                const diff = oldQty - newQty; 
                const newStock = (product.qty || 0) + diff;
                
                if(newStock < 0) {
                    btn.innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข'; btn.disabled = false;
                    return alert(`❌ สต็อกสินค้าไม่เพียงพอสำหรับการแก้ไขยอดเบิกใหม่!\n(สต็อกปัจจุบันมีเพียง ${product.qty} ชิ้น)`);
                }
                await updateDoc(doc(db, "products", product.id), { qty: newStock });
            }
        }

        await updateDoc(doc(db, "withdraw_history", id), { qty: newQty, note: newNote });
        window.closeEditWithdrawModal();
        alert('✅ แก้ไขประวัติการเบิกเรียบร้อยแล้ว');
    } catch (e) {
        alert('ข้อผิดพลาด: ' + e.message);
    }

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

window.openEditWithdrawModal = function(id) {
    const item = withdrawHistory.find(h => h.id === id);
    if(!item) return;
    document.getElementById('editWithdrawId').value = item.id;
    document.getElementById('editWithdrawOldQty').value = item.qty || 0;
    document.getElementById('editWithdrawTitle').innerText = `เอกสาร: ${item.docId || '-'} (${item.itemName || '-'})`;
    document.getElementById('editWithdrawQtyInput').value = item.qty || 0;
    document.getElementById('editWithdrawNoteInput').value = item.note || '';
    document.getElementById('editWithdrawModal').classList.remove('hidden');
};

window.closeEditWithdrawModal = () => document.getElementById('editWithdrawModal').classList.add('hidden');

window.deleteWithdraw = async (id) => {
    const item = withdrawHistory.find(h => h.id === id);
    if(!item) return;

    if(confirm(`⚠️ คุณต้องการลบรายการเบิก "${item.docId || '-'}" (${item.itemName}) ใช่หรือไม่?\n\n*ระบบจะทำการคืนยอดสินค้าจำนวน ${item.qty} ชิ้น กลับเข้าสต็อกให้อัตโนมัติ*`)) {
        try {
            const product = findProductForHistory(item);
            if(product) {
                const newStock = (product.qty || 0) + (Number(item.qty) || 0);
                await updateDoc(doc(db, "products", product.id), { qty: newStock });
            }
            await deleteDoc(doc(db, "withdraw_history", id));
            alert('🗑️ ลบรายการเบิกและคืนสต็อกสินค้าเรียบร้อยแล้ว');
        } catch (e) {
            alert('ข้อผิดพลาดในการลบ: ' + e.message);
        }
    }
};

window.printPDF = (id, name, code, qty, user, date) => {
    currentPrintData = { id, name, code, qty, user, date };
    document.getElementById('pdfDocId').innerText = id || '-'; 
    document.getElementById('pdfUser').innerText = user || '-';
    document.getElementById('pdfDate').innerText = date || '-'; 
    document.getElementById('pdfItemCode').innerText = code || '-';
    document.getElementById('pdfItemName').innerText = name || '-'; 
    document.getElementById('pdfItemQty').innerText = qty || '-';
    document.getElementById('printPreviewModal').classList.remove('hidden');
};

window.closePrintModal = () => {
    document.getElementById('printPreviewModal').classList.add('hidden');
};

window.confirmDownloadPDF = () => {
    const el = document.getElementById('printableArea');
    const btn = document.getElementById('confirmPrintBtn');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังสร้าง PDF...';
    btn.disabled = true;

    const opt = {
        margin:       10,
        filename:     `ใบเบิก_${currentPrintData.id || 'เอกสาร'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(el).save().then(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        window.closePrintModal();
    });
};
