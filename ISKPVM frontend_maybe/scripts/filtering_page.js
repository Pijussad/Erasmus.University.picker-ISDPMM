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

const reports = collection(db, "Reports")

async function queryUniversities(filters) {
    try {
        let q = collection(db, "universities");
        let queries = [];
        for (const [field, value] of Object.entries(filters)) {
            if (value !== "-") {
                if (field === "kalba"){
                    queries.push(where("kalbos", "array-contains", value));
                } else if (field === "fakultetas"){
                    queries.push(where(field, "==", value));
                } else {
                    queries.push(where(field, "==", value));
                }
            }
        }
        if (queries.length > 0) {
            q = query(q, ...queries);
        }
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() });
        });
        return results;
    } catch (error) {
        console.error("Error querying universities:", error);
        return [];
    }
}

function uniObjToString(univ){
    return Object.entries(univ)
        .map(([field, value]) => `${field}=${value}`)
        .join("\n");
}

function format_and_output(res){
    const out = $("#resOutput");
    out.empty();
    $(".results-count").text(`Rezultatų: ${res.length}`);
    res.forEach((univ) => {
        const card = $(`
            <div class="university-card">
                <div class="university-card-header">
                    <img src="https://via.placeholder.com/60" alt="Univ Image">
                    <div>
                        <h4 style="margin:0;">${univ.universitetas}</h4>
                        <small>${univ.salis || ''}${univ.miestas ? ', ' + univ.miestas : ''}</small>
                    </div>
                </div>
                <div class="university-card-content">
                    <div class="university-details">
                        <div class="university-details-column">
                            <h5>Fakultetas</h5>
                            <p>${univ.fakultetas || '-'}</p>
                            <h5>Studijų sritys</h5>
                            <p>${univ.sritis || '-'}</p>
                            <h5>Kalbos</h5>
                            <p>${(univ.kalbos || []).join(', ') || '-'}</p>
                        </div>
                        <div class="university-details-column">
                            <h5>Studijų lygis</h5>
                            <p>${univ.studijuTipas || '-'}</p>
                            <h5>URL</h5>
                            <a href="${univ.url || '#'}" target="_blank">${univ.url || 'N/A'}</a>
                        </div>
                        <div>
                            <button id="pranestiKlaida" class="btn btn-danger btn-sm">Pranešti klaidą</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        card.on('click', function() {
            $(this).toggleClass('expanded');
        });
        out.append(card);
    });

    out.on('click', '#pranestiKlaida', async function(event){
        const card = $(this).closest('.university-card');

        const universitetas = card.find('h4').text();

        console.log("Pranešti klaidą clicked for:", universitetas);

        const userInput = prompt("Aprašykite klaidą", "nothing");

        if (userInput === null) {
            console.log("User cancelled the input.");
        } else {
            try {
                console.log("User entered:", userInput);
                const reportData = {
                    kodas: universitetas,
                    message: userInput,
                    messageTime: serverTimestamp(),
                    userId: "idk"
                }
    
                const docRef = await addDoc(collection(db, "Reports"), reportData);
                console.log("Report written with ID: ", docRef.id);
            }
            catch (e) {
                console.error("Error adding report: ", e);
            }
        }
    });
}

$(document).ready(async function () {
    const emptyfilters = {
        fakultetas: "-",
        programa: "-",
        studijuTipas: "-",
        semestras: "-",
        salis: "-",
        miestas: "-",
        regionas: "-",
        universitetas: "-",
        kalba: "-"
    };
    const res = await queryUniversities(emptyfilters);
    if (res.length != 0){
        format_and_output(res);
        find_unique_and_populate_html(res);
    } else {
        console.log("Failed getting query results !!!");
    }

    $('button.btn-primary').on('click',async function() {
        const _fakultetas = $('#faculty').val() || "-";
        const _programa = $('#program').val() || "-";
        const _studijuTipas = $('#studyType').val() || "-";
        const _semestras = $('#semester').val() || "-";
        const _salis = $('#country').val() || "-";
        const _miestas = $('#city').val() || "-";
        const _regionas = $('#region').val() || "-";
        const _universitetas = $('#university').val() || "-";
        const _kalba = $('#language').val() || "-";

        const filters = {
            fakultetas: _fakultetas,
            programa: _programa,
            studijuTipas: _studijuTipas,
            semestras: _semestras,
            salis: _salis,
            miestas: _miestas,
            regionas: _regionas,
            universitetas: _universitetas,
            kalba: _kalba
        };
        const res = await queryUniversities(filters);
        format_and_output(res);
    });



});

async function fetchFaculties() {
    const querySnapshot = await getDocs(collection(db, 'VU_courses'));
    const faculties = [];
    if (!querySnapshot.empty) {
        querySnapshot.forEach(doc => {
            faculties.push(doc.id);
        });
    }
    return faculties;
}

function find_unique_and_populate_html(res) {
    const _language = $('#language');
    const uniqueLanguage = [...new Set(res.flatMap(r => r.kalbos || []))];
    uniqueLanguage.forEach((el) => {
        _language.append(`<option>${el}</option>`)
    });
    const _countrys = $('#country');
    const uniqueCountrys = [...new Set(res.map(r => r.salis).filter(Boolean))];
    uniqueCountrys.forEach((el) => {
        _countrys.append(`<option>${el}</option>`)
    });
    const _universitys = $('#university');
    const uniqueUniversitys = [...new Set(res.map(r => r.universitetas).filter(Boolean))];
    uniqueUniversitys.forEach((el) => {
        _universitys.append(`<option>${el}</option>`)
    });
    const _cities = $('#city');
    const uniqueCities = [...new Set(res.map(r => r.miestas).filter(Boolean))];
    uniqueCities.forEach((el) => {
        _cities.append(`<option>${el}</option>`)
    });
    const _regions = $('#region');
    const uniqueRegions = [...new Set(res.map(r => r.regionas).filter(Boolean))];
    uniqueRegions.forEach((el) => {
        _regions.append(`<option>${el}</option>`)
    });
}
