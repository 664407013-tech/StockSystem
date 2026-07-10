import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// นำ Config ของคุณมาวางตรงนี้
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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