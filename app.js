import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// เพิ่ม updateDoc และ getDoc เพื่อทำระบบเบิกสินค้า
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);
let myChart = null; // ตัวแปรกราฟ

// 1. ระบบเปลี่ยนหน้า (SPA Navigation)
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        // เอาคลาส active ออกจากเมนูและเนื้อหาทั้งหมด
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        
        // เพิ่มคลาส active ให้เป้าหมายที่ถูกคลิก
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// 2. เช็คล็อกอิน & ออกจากระบบ
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});
document.getElementById("logoutBtn").addEventListener("click", () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

// 3. ฟังก์ชันโหลดข้อมูลหลัก (อัปเดตตาราง, กราฟ, และตัวเลือกเบิกสินค้า)
async function loadData() {
    const querySnapshot = await getDocs(collection(db, "products"));
    
    // ตัวแปรสำหรับ DOM
    const tableBody = document.getElementById("stockTableBody");
    const withdrawSelect = document.getElementById("withdrawSelect");
    tableBody.innerHTML = "";
    withdrawSelect.innerHTML = '<option value="">-- กรุณาเลือกสินค้า --</option>';
    
    // ตัวแปรสำหรับคำนวณและกราฟ
    let totalItems = 0;
    let totalValue = 0;
    let chartLabels = [];
    let chartData = [];

    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;

        // คำนวณสรุปยอด
        totalItems += 1; // นับจำนวนรายการ
        totalValue += (data.qty * data.price); // มูลค่ารวม
        
        // เก็บข้อมูลทำกราฟ
        chartLabels.push(data.name);
        chartData.push(data.qty);

        // 3.1 สร้างแถวในตาราง
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${data.name}</strong></td>
            <td>${data.qty.toLocaleString()}</td>
            <td>฿${data.price.toLocaleString()}</td>
            <td><button class="btn-sm delete-btn" data-id="${id}"><i class="fas fa-trash"></i> ลบ</button></td>
        `;
        tableBody.appendChild(row);

        // 3.2 สร้างตัวเลือกในหน้าเบิกสินค้า (แสดงเฉพาะของที่มีสต็อก > 0)
        if(data.qty > 0) {
            const option = document.createElement("option");
            option.value = id;
            option.text = `${data.name} (คงเหลือ: ${data.qty})`;
            withdrawSelect.appendChild(option);
        }
    });

    // อัปเดตตัวเลขหน้า Dashboard
    document.getElementById("totalItems").innerText = totalItems.toLocaleString();
    document.getElementById("totalValue").innerText = totalValue.toLocaleString();

    // Event ปุ่มลบ
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("แน่ใจหรือไม่ว่าต้องการลบสินค้านี้?")) {
                const id = e.target.closest('button').getAttribute('data-id');
                await deleteDoc(doc(db, "products", id));
                loadData(); 
            }
        });
    });

    // อัปเดตกราฟ Chart.js
    updateChart(chartLabels, chartData);
}

// 4. ฟังก์ชันจัดการกราฟ (Chart.js)
function updateChart(labels, data) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    // ต้องลบกราฟเก่าทิ้งก่อนวาดใหม่ ป้องกันบัคซ้อนทับกัน
    if (myChart) { myChart.destroy(); }
    
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'จำนวนสินค้าคงเหลือ',
                data: data,
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// 5. ระบบเพิ่มสินค้า
document.getElementById("addBtn").addEventListener("click", async () => {
    const name = document.getElementById("itemName").value;
    const qty = document.getElementById("itemQty").value;
    const price = document.getElementById("itemPrice").value;

    if(name && qty && price) {
        await addDoc(collection(db, "products"), {
            name: name,
            qty: Number(qty),
            price: Number(price)
        });
        // ล้างฟอร์ม
        document.getElementById("itemName").value = "";
        document.getElementById("itemQty").value = "";
        document.getElementById("itemPrice").value = "";
        alert("เพิ่มสินค้าสำเร็จ!");
        loadData(); 
    } else {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    }
});

// 6. ระบบเบิกสินค้า (อัปเดตจำนวนในฐานข้อมูล)
document.getElementById("withdrawBtn").addEventListener("click", async () => {
    const select = document.getElementById("withdrawSelect");
    const id = select.value;
    const qtyToWithdraw = Number(document.getElementById("withdrawQty").value);

    if(!id || qtyToWithdraw <= 0) {
        alert("กรุณาเลือกสินค้าและระบุจำนวนที่ถูกต้อง");
        return;
    }

    try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const currentQty = docSnap.data().qty;
            
            if(qtyToWithdraw > currentQty) {
                alert(`เบิกไม่ได้! สินค้าคงเหลือมีแค่ ${currentQty} ชิ้น`);
            } else {
                // อัปเดตจำนวนใหม่ = จำนวนเดิม - จำนวนที่เบิก
                await updateDoc(docRef, { qty: currentQty - qtyToWithdraw });
                document.getElementById("withdrawQty").value = ""; // ล้างฟอร์ม
                alert("เบิกสินค้าเรียบร้อยแล้ว!");
                loadData(); // โหลดข้อมูลใหม่ทั้งหมด (อัปเดตกราฟและตารางอัตโนมัติ)
            }
        }
    } catch (error) {
        console.error("Error updating document: ", error);
        alert("เกิดข้อผิดพลาดในการเบิกสินค้า");
    }
});

// โหลดข้อมูลครั้งแรกที่เปิดหน้าเว็บ
loadData();
