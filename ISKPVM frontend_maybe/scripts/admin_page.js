
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc, orderBy, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
    const q = query(messagesRef, orderBy('messageTime', 'desc'));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      messageList.append("<tr><td>No reports found.</td></tr>");  // Proper table cell
      return; // Early exit if no reports
    }

    messageList.empty(); // Clear the table before adding new data

    querySnapshot.forEach(doc => {
    const data = doc.data();
    const messageTime = data.messageTime ? data.messageTime.toDate().toLocaleString() : "N/A";

    const row = $("<tr></tr>"); // Create a row element
      row.append(`<td>${data.kodas || 'N/A'}</td>`);
      row.append(`<td>${data.message || 'N/A'}</td>`);
      row.append(`<td>${data.userId || 'N/A'}</td>`);
      row.append(`<td>${messageTime}</td>`); // Add the formatted time
      
      const button = $("<button>Delete</button>");
      button.click(async () => {
        try {
          await deleteDoc(doc.ref);
          row.remove();
          console.log("Report deleted successfully!");
        } catch (error) {
          console.error("Error deleting report:", error);
        }
      });
      const buttonCell = $("<td></td>").append(button);
      row.append(buttonCell);

      messageList.append(row);
    });

  } catch (error) {
    console.error("Error loading messages:", error);
    messageList.empty().append("<tr><td>Error loading messages. Please try again later.</td></tr>"); // More user-friendly message
  }
}



const commentsRef = collection(db, "Comments"); // Reference to the Comments collection

async function updateCommentsForUser(userName) {
  try {
    const q = query(commentsRef, where("userID", "==", userName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("No comments found for the specified user.");
      return;
    }

    querySnapshot.forEach(async (commentDoc) => {
      try {
        const commentRef = doc(db, "Comments", commentDoc.id); // Reference to the specific document
        await updateDoc(commentRef, {
          allowed: false // Replace 'status' with the field you want to update
        });
        console.log(`Document ${commentDoc.id} updated successfully.`);
      } catch (error) {
        console.error(`Error updating document ${commentDoc.id}:`, error);
      }
    });

    const userRef = doc(db, "Users", userName);
    await updateDoc(userRef, {
      isBlocked: true 
    });
  } catch (error) {
    console.error("Error querying comments:", error);
  }
}

$(document).ready(async function() {
    loadMessages();

    const blockButton = $("#block_user_comments");
    blockButton.on('click', function(){
      const user = $('#userSearch').val()
      console.log(user);
      updateCommentsForUser(user);
    });


    // ... (rest of your document.ready code) ...
});