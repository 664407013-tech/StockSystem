import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ นำ Config ของคุณจาก Firebase มาวางแทนที่ตรงนี้ทั้งหมด ⚠️
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

let myChart = null;
let products = [];
let withdrawHistory = []; 

// --- ระบบเปลี่ยนหน้าต่าง (Navigation) ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
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

document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('show');
});

// --- แปลงรูปภาพเป็น Base64 ---
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// --- โหลดข้อมูล (Real-time) ---
function loadData() {
    onSnapshot(collection(db, "products"), (snapshot) => {
        products = [];
        snapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        updateUI();
    });

    onSnapshot(collection(db, "withdraw_history"), (snapshot) => {
        withdrawHistory = [];
        snapshot.forEach((doc) => {
            withdrawHistory.push({ id: doc.id, ...doc.data() });
        });
        withdrawHistory.sort((a, b) => b.timestamp - a.timestamp);
        updateUI();
    });
}

// --- อัปเดตหน้าจอ ---
function updateUI(filteredHistory = null) {
    const tbody = document.getElementById('stockTableBody');
    const select = document.getElementById('withdrawSelect');
    tbody.innerHTML = '';
    select.innerHTML = '<option value="">-- กรุณาเลือกสินค้า --</option>';

    let totalVal = 0;
    let chartLabels = [];
    let chartData = [];

    // เรนเดอร์สินค้า
    products.forEach(p => {
        const pQty = p.qty || 0;
        const pPrice = p.price || 0;
        const pCode = p.code || '-';
        const pName = p.name || 'ไม่ระบุ';

        totalVal += (pQty * pPrice);
        chartLabels.push(pName);
        chartData.push(pQty);

        const imgTag = p.image ? `<img src="${p.image}" class="w-10 h-10 rounded-lg object-cover">` : `<div class="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400"><i class="fas fa-image"></i></div>`;
        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-4">${imgTag}</td>
                <td class="p-4 font-medium text-gray-900">${pCode}</td>
                <td class="p-4">${pName}</td>
                <td class="p-4 ${pQty < 50 ? 'text-red-500 font-bold' : 'text-gray-600'}">${pQty.toLocaleString()}</td>
                <td class="p-4 text-gray-600">฿${pPrice.toLocaleString()}</td>
                <td class="p-4 text-center">
                    <button class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;

        if(pQty > 0) {
            select.innerHTML += `<option value="${p.id}">${pCode} - ${pName} (คงเหลือ: ${pQty})</option>`;
        }
    });

    document.getElementById('totalItemsDisplay').innerText = products.length.toLocaleString();
    document.getElementById('totalValueDisplay').innerText = totalVal.toLocaleString();

    // อัปเดตกราฟ
    const ctx = document.getElementById('stockChart').getContext('2d');
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'จำนวนสินค้าคงเหลือ',
                data: chartData,
                backgroundColor: '#4f46e5',
                borderRadius: 6
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // อัปเดตประวัติการเบิก
    const historyToRender = filteredHistory || withdrawHistory;
    const trackList = document.getElementById('trackingList');
    trackList.innerHTML = '';
    
    if(historyToRender.length === 0) {
        trackList.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">ไม่มีประวัติการทำรายการ</p>';
    } else {
        historyToRender.forEach(h => {
            const hCode = h.code || '-';
            const hName = h.itemName || '-';
            const hNote = h.note || 'ไม่ระบุ';
            
            trackList.innerHTML += `
                <div class="p-4 border border-gray-100 rounded-xl bg-gray-50 flex justify-between items-center mb-2">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-md font-medium">สำเร็จ</span>
                            <span class="text-sm font-medium text-gray-800">${h.docId}</span>
                        </div>
                        <p class="text-sm text-gray-600">เบิก: <strong>${hName}</strong> (${h.qty} ชิ้น)</p>
                        <p class="text-xs text-gray-400 mt-1">ผู้เบิก: ${hNote} | ${h.date}</p>
                    </div>
                    <button onclick="printPDF('${h.docId}', '${hName}', '${hCode}', '${h.qty}', '${hNote}', '${h.date}')" class="text-indigo-600 hover:bg-indigo-100 p-2 rounded-lg transition" title="พิมพ์ใบเบิก">
                        <i class="fas fa-print text-lg"></i>
                    </button>
                </div>
            `;
        });
    }
}

// --- เพิ่มสินค้า ---
document.getElementById('addBtn').addEventListener('click', async () => {
    const codeVal = document.getElementById('itemCode').value.trim();
    const nameVal = document.getElementById('itemName').value.trim();
    const qtyVal = Number(document.getElementById('itemQty').value) || 0;
    const priceVal = Number(document.getElementById('itemPrice').value) || 0;
    const fileInput = document.getElementById('itemImage');
    
    if(!nameVal) return alert("กรุณากรอกชื่อสินค้าอย่างน้อยครับ");

    const btn = document.getElementById('addBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

    let base64Image = '';
    if(fileInput.files.length > 0) {
        base64Image = await getBase64(fileInput.files[0]);
    }

    try {
        await addDoc(collection(db, "products"), {
            code: codeVal || "-",
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
        alert('เพิ่มสินค้าสำเร็จ');
    } catch (e) {
        console.error("Error adding document: ", e);
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + e.message);
    }

    btn.innerHTML = '<i class="fas fa-save"></i> บันทึกข้อมูล';
    btn.disabled = false;
});

// --- ลบสินค้า ---
window.deleteProduct = async function(id) {
    if(confirm('ยืนยันการลบสินค้า?')) {
        try {
            await deleteDoc(doc(db, "products", id));
        } catch (e) {
            console.error(e);
            alert("ลบสินค้าไม่สำเร็จ");
        }
    }
}

// --- เบิกสินค้า ---
document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const id = document.getElementById('withdrawSelect').value;
    const qty = Number(document.getElementById('withdrawQty').value);
    const note = document.getElementById('withdrawNote').value.trim();

    if(!id || qty <= 0) return alert('ข้อมูลการเบิกไม่ถูกต้อง');

    const product = products.find(p => p.id === id);
    if(!product) return alert('หาสินค้าไม่พบในระบบ');
    if(product.qty < qty) return alert('สินค้าคงเหลือไม่เพียงพอ!');

    const btn = document.getElementById('withdrawBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังประมวลผล...';
    btn.disabled = true;

    try {
        // 1. ตัดสต็อก
        const newQty = product.qty - qty;
        await updateDoc(doc(db, "products", id), { qty: newQty });

        // 2. บันทึกประวัติ
        const docId = 'DOC-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        await addDoc(collection(db, "withdraw_history"), {
            docId: docId,
            itemName: product.name || 'ไม่ระบุ',
            code: product.code || '-',
            qty: qty,
            note: note || 'ไม่ระบุ',
            date: dateStr,
            timestamp: Date.now()
        });

        document.getElementById('withdrawQty').value = '';
        document.getElementById('withdrawNote').value = '';
        
        if(confirm('เบิกสำเร็จ! ต้องการพิมพ์ใบเบิกเป็น PDF เลยหรือไม่?')) {
            window.printPDF(docId, product.name, product.code || '-', qty, note || 'ไม่ระบุ', dateStr);
        }
    } catch (e) {
        console.error("Error updating: ", e);
        alert('เกิดข้อผิดพลาดในการเบิกสินค้า: ' + e.message);
    }

    btn.innerHTML = '<i class="fas fa-check-circle"></i> ยืนยันการเบิก';
    btn.disabled = false;
});

// --- ค้นหาตามวันที่ ---
document.getElementById('searchDateBtn').addEventListener('click', () => {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if(startDate && endDate) {
        const start = new Date(startDate).setHours(0,0,0,0);
        const end = new Date(endDate).setHours(23,59,59,999);
        
        const filtered = withdrawHistory.filter(h => h.timestamp >= start && h.timestamp <= end);
        updateUI(filtered);
    } else {
        updateUI();
    }
});

// --- สร้าง PDF ---
window.printPDF = function(docId, itemName, code, qty, user, date) {
    document.getElementById('pdfDocId').innerText = docId;
    document.getElementById('pdfUser').innerText = user;
    document.getElementById('pdfDate').innerText = date;
    document.getElementById('pdfItemCode').innerText = code;
    document.getElementById('pdfItemName').innerText = itemName;
    document.getElementById('pdfItemQty').innerText = qty;

    const element = document.getElementById('pdfTemplate');
    element.classList.remove('hidden');

    const opt = {
        margin: 10,
        filename: `Withdraw_${docId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        element.classList.add('hidden');
    });
}

// เริ่มต้นระบบ
loadData();
