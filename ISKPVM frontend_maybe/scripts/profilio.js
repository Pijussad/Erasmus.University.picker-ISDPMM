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


$(document).ready(async function () {

    
        const atsijungtiButton = document.getElementById('atsijungti');
        const facultySelect = document.getElementById('faculty');
        const studyTypeSelect = document.getElementById('studyType');
        const programSelect = document.getElementById('program');
        const semesterSelect = document.getElementById('semester');
        const requiredSubjectsList = document.querySelector('.form-group ul'); // Assuming it's a <ul> list for required subjects
    
    
        atsijungtiButton.addEventListener('click', function() {
            localStorage.clear();
        });

        const facultyDataPromise = fetchFaculties();
        const faculties = await facultyDataPromise;
        populateDropdown(facultySelect, faculties);
    
        // Initialize dependent fields as disabled
        function resetAndDisableFields() {
            studyTypeSelect.disabled = true;
            programSelect.disabled = true;
            semesterSelect.disabled = true;
            studyTypeSelect.disabled = true;
    
            // Reset all dropdowns to their default options
            programSelect.innerHTML = '<option selected></option>';
            semesterSelect.innerHTML = '<option selected></option>';
            studyTypeSelect.innerHTML = '<option selected></option>';
        }
    
        // Enable the next field
        function enableNextField(field) {
            field.disabled = false;
        }
    
        async function fetchAndUpdateFacultyData() {
            const selectedFaculty = facultySelect.value.replace(/\s+/g, '_');
    
            if (selectedFaculty) {
                // Fetch the courses for the selected faculty
                const docRef = doc(db, 'VU_courses', selectedFaculty);
                const docSnap = await getDoc(docRef);
    
                if (docSnap.exists()) {
                    const facultyData = docSnap.data();
    
                    studyTypeSelect.innerHTML = '<option selected>Bakalauro</option>';
                    // Populate program dropdown
                    programSelect.innerHTML = '<option selected>Pasirinkti studijų programą...</option>';
                    Object.keys(facultyData).forEach(courseName => {
                        const programOption = document.createElement('option');
                        programOption.textContent = courseName.replace(/_/g, ' ');
                        programOption.value = courseName.replace(/_/g, ' ');
                        programSelect.appendChild(programOption);
                    });
    
                    // Enable program field
                    enableNextField(programSelect);
    
                    // Handle program selection
                    programSelect.addEventListener('change', function () {
                        const selectedProgram = programSelect.value.replace(/\s+/g, '_');
                        semesterSelect.innerHTML = '<option selected>Pasirinkti semestrą...</option>';
    
                        if (facultyData[selectedProgram]) {
                            const semesters = facultyData[selectedProgram];
                            semesters.forEach((semester, index) => {
                                const semesterOption = document.createElement('option');
                                semesterOption.textContent = `${index + 1} semestras`;
                                semesterOption.value = index + 1;
                                semesterSelect.appendChild(semesterOption);
                            });
    
                            // Enable semester field
                            enableNextField(semesterSelect);
    
                            // When the semester is selected, update the required subjects list
                            semesterSelect.addEventListener('change', function() {
                                const selectedSemester = semesterSelect.value;
                                if (selectedSemester) {
                                    const selectedSemesterData = facultyData[selectedProgram][selectedSemester - 1]; // Get the semester data (adjusted for index)
                                    requiredSubjectsList.innerHTML = ''; // Clear existing list
    
                                    if (selectedSemesterData && selectedSemesterData.privalomi && selectedSemesterData.privalomi.length > 0) {
                                        selectedSemesterData.privalomi.forEach(subject => {
                                            const listItem = document.createElement('li');
                                            listItem.textContent = subject;
                                            requiredSubjectsList.appendChild(listItem);
                                        });
                                    } else {
                                        const noSubjectsMessage = document.createElement('li');
                                        noSubjectsMessage.textContent = 'No required subjects for this semester.';
                                        requiredSubjectsList.appendChild(noSubjectsMessage);
                                    }
                                }
                            });
                        }
                    });
                }
            } else {
                resetAndDisableFields(); // Reset all if no faculty is selected
            }
        }
    
        // Populate dropdown helper
        function populateDropdown(dropdown, data) {
            dropdown.innerHTML = '<option selected>Pasirinkti fakultetą...</option>';
            data.forEach(item => {
                const option = document.createElement('option');
                option.textContent = item.replace(/_/g, ' ');
                option.value = item.replace(/_/g, ' ');
                dropdown.appendChild(option);
            });
        }
    
        facultySelect.addEventListener('change', async function () {
            const isValidFaculty = facultySelect.value !== "Pasirinkti fakultetą...";
    
            // Enable/disable form elements based on faculty selection
            studyTypeSelect.disabled = !isValidFaculty;
            programSelect.disabled = !isValidFaculty;
            semesterSelect.disabled = true; // Reset semester for new faculty selection
    
            // Reset program and semester if faculty is invalid
            if (!isValidFaculty) {
                console.log("1")
                resetAndDisableFields();
            }
    
            // Fetch and update faculty data
            if (isValidFaculty) {
                console.log("2")
                semesterSelect.innerHTML = '<option selected></option>';
                await fetchAndUpdateFacultyData();
            }
        });

    
    
    
    
    function find_unique_and_populate_html(res) {
    
        //Language
        const _language = $('#language');
        const uniqueLanguage = [...new Set(res.flatMap(res => res.kalbos))];
        uniqueLanguage.forEach((el) => {
            _language.append(`<option>${el}</option>`)
        });
    
        //Countrys
        const _countrys = $('#country');
        const uniqueCountrys = [...new Set(res.map(res => res.salis))];
        uniqueCountrys.forEach((el) => {
            _countrys.append(`<option>${el}</option>`)
        });
    
        // University
        const _universitys = $('#university');
        const uniqueUniversitys = [...new Set(res.map(res => res.universitetas))];
        uniqueUniversitys.forEach((el) => {
            _universitys.append(`<option>${el}</option>`)
        });
    }

});


// Fetch faculties (returns array of faculty names)
async function fetchFaculties() {
    const querySnapshot = await getDocs(collection(db, 'VU_courses'));
    const faculties = [];
    if (!querySnapshot.empty) {
        querySnapshot.forEach(doc => {
            faculties.push(doc.id); // Document name is the faculty name
        });
    }
    return faculties;
}