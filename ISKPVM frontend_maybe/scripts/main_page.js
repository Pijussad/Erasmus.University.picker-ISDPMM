import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where, getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

let isSignUpMode = false;

// Fetch faculties from VU_courses
async function fetchFaculties() {
    const querySnapshot = await getDocs(collection(db, 'VU_courses'));
    const faculties = [];
    if (!querySnapshot.empty) {
        querySnapshot.forEach(docu => {
            faculties.push(docu.id);
        });
    }
    return faculties;
}

// Load faculty data for progressive dropdowns
async function loadFacultyData(facultyName) {
    try {
        const docRef = doc(db, 'VU_courses', facultyName.replace(/\s+/g, '_'));
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.error("No such faculty document!");
            return null;
        }
    } catch (error) {
        console.error("Error loading faculty data:", error);
        return null;
    }
}

// Get next user ID
async function getNextUserId() {
    try {
        const usersRef = collection(db, 'Users');
        const snapshot = await getDocs(usersRef);
        
        let maxId = 0;
        snapshot.forEach(doc => {
            const docId = doc.id;
            if (docId.startsWith('User')) {
                const idNumber = parseInt(docId.substring(4), 10);
                if (!isNaN(idNumber) && idNumber > maxId) {
                    maxId = idNumber;
                }
            }
        });
        console.log(maxId + 1);
        return `User${maxId + 1}`;
    } catch (error) {
        console.error("Error getting next user ID:", error);
        return `User${Date.now()}`;
    }
}

// Populate dropdown with options
function populateDropdown(dropdown, options, placeholder = "Pasirinkite...") {
    dropdown.innerHTML = `<option value="">${placeholder}</option>`;
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.replace(/_/g, ' ');
        optionElement.textContent = option.replace(/_/g, ' ');
        dropdown.appendChild(optionElement);
    });
}

// Toggle between login and signup modes
function toggleSignUpMode() {
    const formTitle = document.querySelector('.form-title');
    const submitButton = document.getElementById('submitLogin');
    const signupLink = document.querySelector('.signup-link');
    const form = document.querySelector('.form');
    
    if (!isSignUpMode) {
        // Switch to signup mode
        isSignUpMode = true;
        formTitle.textContent = 'Create your account';
        submitButton.textContent = 'Sign up';
        signupLink.innerHTML = 'Already have an account? <a href="#" id="switchToLogin">Sign in</a>';
        
        // Add signup-specific fields
        const signupFields = `
            <div id="signupFields">
                <div class="input-container">
                    <select id="faculty" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 5px; ">
                        <option value="">Kraunasi fakultetai...</option>
                    </select>
                </div>
                <div class="input-container">
                    <select id="studyType" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 5px; " disabled>
                        <option value="">Pasirinkite studijų tipą...</option>
                    </select>
                </div>
                <div class="input-container">
                    <select id="studyProgram" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 5px; " disabled>
                        <option value="">Pasirinkite studijų programą...</option>
                    </select>
                </div>
            </div>
        `;
        
        // Insert signup fields before the submit button
        submitButton.insertAdjacentHTML('beforebegin', signupFields);
        
        // Setup faculty dropdown functionality
        setupFacultyDropdown();
        
        // Add event listener for switch back to login
        document.getElementById('switchToLogin').addEventListener('click', function(e) {
            e.preventDefault();
            toggleSignUpMode();
        });
        
    } else {
        // Switch back to login mode
        isSignUpMode = false;
        formTitle.textContent = 'Sign in to your account';
        submitButton.textContent = 'Sign in';
        signupLink.innerHTML = 'No account? <a href="#" id="switchToSignup">Sign up</a>';
        
        // Remove signup fields
        const signupFields = document.getElementById('signupFields');
        if (signupFields) {
            signupFields.remove();
        }
        
        // Add event listener for switch to signup
        document.getElementById('switchToSignup').addEventListener('click', function(e) {
            e.preventDefault();
            toggleSignUpMode();
        });
    }
}

// Setup faculty dropdown with progressive functionality
async function setupFacultyDropdown() {
    try {
        const facultySelect = document.getElementById('faculty');
        const studyTypeSelect = document.getElementById('studyType');
        const studyProgramSelect = document.getElementById('studyProgram');
        
        // Load and populate faculties
        const faculties = await fetchFaculties();
        populateDropdown(facultySelect, faculties, "Pasirinkite fakultetą...");
        
        // Faculty change handler
        facultySelect.addEventListener('change', async function() {
            const selectedFaculty = this.value;
            
            // Reset dependent dropdowns
            studyTypeSelect.innerHTML = '<option value="">Pasirinkite studijų tipą...</option>';
            studyProgramSelect.innerHTML = '<option value="">Pasirinkite studijų programą...</option>';
            studyTypeSelect.disabled = true;
            studyProgramSelect.disabled = true;
            
            if (selectedFaculty) {
                try {
                    const facultyData = await loadFacultyData(selectedFaculty);
                    if (facultyData) {
                        // Enable and populate study type (Bakalauro for now)
                        studyTypeSelect.innerHTML = '<option value="Bakalauro">Bakalauro</option>';
                        studyTypeSelect.disabled = false;
                        studyTypeSelect.value = "Bakalauro";
                        
                        // Enable and populate study programs
                        const programs = Object.keys(facultyData);
                        studyProgramSelect.disabled = false;
                        populateDropdown(studyProgramSelect, programs, "Pasirinkite studijų programą...");
                        
                    }
                } catch (error) {
                    console.error("Error loading faculty data:", error);
                }
            }
        });
        
    } catch (error) {
        console.error("Error setting up faculty dropdown:", error);
    }
}

// Handle user registration
async function handleSignUp(userEmail, userPassword) {
    try {
        const facultySelect = document.getElementById('faculty');
        const studyTypeSelect = document.getElementById('studyType');
        const studyProgramSelect = document.getElementById('studyProgram');
        
        // Validate required fields
        if (!facultySelect.value) {
            alert('Pasirinkite fakultetą');
            return false;
        }
        
        if (!studyTypeSelect.value) {
            alert('Pasirinkite studijų tipą');
            return false;
        }
        
        if (!studyProgramSelect.value) {
            alert('Pasirinkite studijų programą');
            return false;
        }
        
        // Check if user already exists
        const usersRef = collection(db, 'Users');
        const q = query(usersRef, where('userName', '==', userEmail));
        const existingUser = await getDocs(q);
        
        if (!existingUser.empty) {
            alert('Šis el. paštas jau naudojamas');
            return false;
        }
        
        // Get next user ID
        const nextUserId = await getNextUserId();
        
        // Create user data
        const userData = {
            userName: userEmail,
            password: userPassword,
            faculty: facultySelect.value,
            studyType: studyTypeSelect.value,
            studyProgram: studyProgramSelect.value,
            isAdmin: false,
            isBlocked: false,
            savedUniversities: [],
            semester: 0
        };
        
        // Add user to database
        await setDoc(doc(db, "Users", nextUserId), userData);
        alert('Registracija sėkminga! Dabar galite prisijungti.');
        
        // Switch back to login mode
        toggleSignUpMode();
        
        return true;
        
    } catch (error) {
        console.error('Error during registration:', error);
        alert('Klaida registruojant vartotoją');
        return false;
    }
}

// Handle user login
async function handleLogin(userEmail, userPassword) {
    try {
        const usersRef = collection(db, 'Users');
        const q = query(usersRef, where('userName', '==', userEmail));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();

            if (userData.password === userPassword) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('isAdmin', userData.isAdmin || false);
                localStorage.setItem('userName', userData.userName);
                localStorage.setItem('isBlocked', userData.isBlocked || false);

                const profilisButton = document.getElementById('profilis');
                const prisijungtiButton = document.getElementById('prisijungti');
                const loginPopup = document.getElementById('loginPopup');
                
                profilisButton.style.display = 'flex';
                prisijungtiButton.style.display = 'none';    
                loginPopup.style.display = 'none';
                
                // Clear form
                document.querySelector('input[type="text"]').value = '';
                document.querySelector('input[type="password"]').value = '';
                
                return true;
            } else {
                alert('Neteisingas slaptažodis');
                return false;
            }
        } else {
            alert('Vartotojas nerastas');
            return false;
        }
    } catch (error) {
        console.error('Error getting user data: ', error);
        alert('Įvyko klaida prisijungiant');
        return false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const prisijungtiButton = document.getElementById('prisijungti');
    const loginPopup = document.getElementById('loginPopup');
    const closeButton = document.getElementById('closeButton');
    const submitLogin = document.getElementById('submitLogin');
    const profilisButton = document.getElementById('profilis');

    // Handle login state on page load
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        profilisButton.style.display = 'flex';
        prisijungtiButton.style.display = 'none';  
    } else {
        profilisButton.style.display = 'none';
    }

    // Show login popup
    prisijungtiButton.addEventListener('click', function() {
        loginPopup.style.display = 'flex';
    });

    // Close login popup
    closeButton.addEventListener('click', function() {
        loginPopup.style.display = 'none';
        // Reset to login mode when closing
        if (isSignUpMode) {
            toggleSignUpMode();
        }
    });

    // Close popup when clicking outside
    loginPopup.addEventListener('click', function(e) {
        if (e.target === loginPopup) {
            loginPopup.style.display = 'none';
            if (isSignUpMode) {
                toggleSignUpMode();
            }
        }
    });

    // Handle form submission (both login and signup)
    submitLogin.addEventListener('click', async function(event) {
        event.preventDefault();

        const userEmail = document.querySelector('input[type="text"]').value.trim();
        const userPassword = document.querySelector('input[type="password"]').value.trim();

        if (!userEmail || !userPassword) {
            alert('Įveskite el. paštą ir slaptažodį');
            return;
        }

        if (isSignUpMode) {
            await handleSignUp(userEmail, userPassword);
        } else {
            await handleLogin(userEmail, userPassword);
        }
    });

    // Initial setup for signup link
    document.getElementById('switchToSignup').addEventListener('click', function(e) {
        e.preventDefault();
        toggleSignUpMode();
    });
});