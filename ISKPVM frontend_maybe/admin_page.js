
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

const messageList = $("#messageList");
const messagesRef = collection(db, "Reports");

async function loadMessages() {
    try {
      const reports = [];
      const q = query(messagesRef, orderBy('messageTime', 'desc')); 

      for await (const doc of (await getDocs(q)).docs) {
        reports.push(doc.data());
      }


      messageList.empty();

      if (reports.length === 0) {
        messageList.append("<li>No reports found.</li>");
      } else {
        reports.forEach((data) => {
          const messageTime = data.messageTime.toDate();
          const formattedDate = messageTime.toLocaleString();

          const messageItem = `
            <li>
              <strong>Kodas:</strong> ${data.kodas || 'N/A'}<br>
              <strong>Message:</strong> ${data.message || 'N/A'}<br>
              <strong>User ID:</strong> ${data.userId || 'N/A'}
            </li>
          `;
          messageList.append(messageItem);
        });
      }

    } catch (error) {
      console.error("Error loading messages:", error);
      messageList.empty().append("<li>Error loading messages.</li>");
    }
  }


$(document).ready(async function() {
    loadMessages();


    // ... (rest of your document.ready code) ...
});