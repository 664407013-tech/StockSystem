import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// นำ Config เดียวกันมาวางตรงนี้
const firebaseConfig = {
  // ... เหมือนไฟล์ auth.js
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// เช็คสิทธิ์การเข้าถึง ถ้าไม่ได้ล็อกอินให้เด้งกลับไปหน้าแรก
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

// ฟังก์ชันออกจากระบบ
document.getElementById("logoutBtn").addEventListener("click", () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

// ฟังก์ชันดึงข้อมูลสต็อก
async function loadStock() {
    const tableBody = document.getElementById("stockTableBody");
    tableBody.innerHTML = ""; 
    const querySnapshot = await getDocs(collection(db, "products"));
    
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${data.name}</td>
            <td>${data.qty}</td>
            <td>${data.price}</td>
            <td><button class="btn-danger delete-btn" data-id="${docSnap.id}">ลบ</button></td>
        `;
        tableBody.appendChild(row);
    });

    // ใส่ Event ให้ปุ่มลบทุกปุ่ม
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            await deleteDoc(doc(db, "products", id));
            loadStock(); // รีเฟรชตาราง
        });
    });
}

// ฟังก์ชันเพิ่มสินค้า
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
        document.getElementById("itemName").value = "";
        document.getElementById("itemQty").value = "";
        document.getElementById("itemPrice").value = "";
        loadStock(); // รีเฟรชตาราง
    } else {
        alert("กรุณากรอกข้อมูลให้ครบ");
    }
});

// โหลดข้อมูลครั้งแรกที่เปิดหน้า
loadStock();