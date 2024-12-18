import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCDrG2mniJa9zEJMm6n4MGf6NLdWH4cbzM",
  authDomain: "erasmus-gidas.firebaseapp.com",
  projectId: "erasmus-gidas",
  storageBucket: "erasmus-gidas.appspot.com",
  messagingSenderId: "687630827561",
  appId: "1:687630827561:web:fc2414b36f4226abfd5c38",
  measurementId: "G-NW8RK7LQR9"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

document.addEventListener('DOMContentLoaded', function() {
    const prisijungtiButton = document.getElementById('prisijungti');
    const loginPopup = document.getElementById('loginPopup');
    const loginButton = document.getElementById('loginButton');
    const closeButton = document.getElementById('closeButton');
    const submitLogin = document.getElementById('submitLogin');
    const profilisButton = document.getElementById('profilis');

    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        profilisButton.style.display = 'flex';
        prisijungtiButton.style.display = 'none';  
    } else {
        profilisButton.style.display = 'none';
    }

    prisijungtiButton.addEventListener('click', function() {
        loginPopup.style.display = 'flex';
    });

    closeButton.addEventListener('click', function() {
        loginPopup.style.display = 'none';
    });

    // Handle login submission
    submitLogin.addEventListener('click', function(event) {
        event.preventDefault(); // Prevent page refresh

        // Get user input (you can also do validation here)
        const userEmail = document.querySelector('input[type="text"]').value;
        const userPassword = document.querySelector('input[type="password"]').value;

        // Query Firestore for the user document
        const usersRef = collection(db,'Users');

        const q = query(usersRef, where('userName', '==', userEmail));
        getDocs(q)
            .then(snapshot => {
                if (!snapshot.empty) {
                    // User exists, check the password
                    const userDoc = snapshot.docs[0];
                    const userData = userDoc.data();

                    if (userData.password === userPassword) {
                        // Login successful, store user info in localStorage
                        localStorage.setItem('isLoggedIn', 'true');
                        localStorage.setItem('isAdmin', userData.isAdmin || false);
                        localStorage.setItem('userName', userData.userName);
                        localStorage.setItem('isBlocked', userData.isBlocked || false);

                        profilisButton.style.display = 'flex';
                        prisijungtiButton.style.display = 'none';    
                        // Close the login popup
                        loginPopup.style.display = 'none';
                    } else {
                        alert('Invalid password');
                    }
                } else {
                    alert('User not found');
                }
            })
            .catch(error => {
                console.error('Error getting user data: ', error);
                alert('An error occurred during login');
            });
    });
});