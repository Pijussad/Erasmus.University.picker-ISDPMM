
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCDrG2mniJa9zEJMm6n4MGf6NLdWH4cbzM",
  authDomain: "erasmus-gidas.firebaseapp.com",
  projectId: "erasmus-gidas",
  storageBucket: "erasmus-gidas.appspot.com",
  messagingSenderId: "687630827561",
  appId: "1:687630827561:web:fc2414b36f4226abfd5c38",
  measurementId: "G-NW8RK7LQR9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);




// Obtaining information from filter page options
$(document).ready(async function () {


    function logout(){
        // Implement your logout logic here (e.g., clear session, redirect)
        //alert("Atsijungėte!"); // Placeholder
        window.location.href = "index.html"; // Redirect to the main page
    }

    async function loadMessages() {
        try {
            const messagesRef = collection(db, "messages"); // Replace "messages" with your collection name
            const querySnapshot = await getDocs(messagesRef);

            const messageList = document.getElementById("messageList");
            messageList.innerHTML = ""; // Clear previous messages

            querySnapshot.forEach((doc) => {
                const messageData = doc.data();
                const messageItem = document.createElement("li");
                const messageLink = document.createElement("a");
                
                messageLink.href = messageData.url || "#"; // Use the URL if available, otherwise "#"
                messageLink.textContent = `${messageData.title || "Untitled"}: ${messageData.message || ""}`; // Display title and message
                


                messageItem.appendChild(messageLink);
                messageList.appendChild(messageItem);
            });


        } catch (error) {
            console.error("Error loading messages:", error);
            // Handle error (e.g., display an error message)
             const messageList = document.getElementById("messageList");
             messageList.innerHTML = "<li>Error loading messages.</li>";

        }
    }

    loadMessages();



});