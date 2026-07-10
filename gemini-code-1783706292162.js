import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// นำ Config ของคุณมาวางตรงนี้
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

// เช็คว่าถ้าล็อกอินอยู่แล้ว ให้เด้งไปหน้า dashboard
onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "dashboard.html";
});

document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    signInWithEmailAndPassword(auth, email, password)
        .then(() => { window.location.href = "dashboard.html"; })
        .catch((error) => {
            document.getElementById("error-msg").innerText = "อีเมลหรือรหัสผ่านไม่ถูกต้อง!";
        });
});
