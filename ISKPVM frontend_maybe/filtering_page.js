

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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


async function queryUniversities(filters) {
    try {
        let q = collection(db, "universities");

        let queries = [];
        for (const [field, value] of Object.entries(filters)) {
            if (value !== "-") {
                if (field === "kalba"){
                    queries.push(where("kalbos", "array-contains", value));
                }
                else if (field === "fakultetas"){
                    queries.push(where(field, "==", value));
                }
                else {
                    queries.push(where(field, "==", value));
                }
            }
        }

        // Combine queries using Firestore's query() function
        if (queries.length > 0) {
            q = query(q, ...queries);
        }

        console.log("Querys", q);

        // Fetch data from Firestore
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

// Object { 
// id: "zn2LoYnGf5cs2FWCltGS", 
// bakalauroT: "9", 
// doktoranturosT: "", 
// sritis: "061 Informacinės ir ryšių technologijos",
// magistroT: "9", 
// universitetas: "Bahcesehir University", 
// kalbos: (1) […], 
// url: "http://www.bahcesehir.edu.tr/", 
// kodas: "TR ISTANBU08", 
// fakultetas: "Matematikos ir informatikos fakultetas"}

    let a = [];
    res.forEach((univ) => {
        a.push("<pre class=\"form-panel-test\">" + uniObjToString(univ) + "</pre>")
    });

    //console.log(a);

    let out = $("#resOutput");
    out.html(a);
}

// Obtaining information from filter page options
$(document).ready(function () {



    // Forma baigta, turime rodiklius pagal kuriuos reikia rasti universitetus
    $('#filters-form').on('submit', async function (event) {
        event.preventDefault(); 

        const _fakultetas = $('#faculty').val();
        const _programa = $('#program').val();
        const _studijuTipas = $('#studyType').val();
        const _semestras = $('#semester').val();
        const _salis = $('#country').val();
        const _miestas = $('#city').val();
        const _regionas = $('#region').val();
        const _universitetas = $('#university').val();
        const _kalba = $('#language').val();
        const _qsIvertinimas = $('#qsRating').val();
        const _pragyvenimoIslaidos = $('#livingCosts').val();

        //console.log(`Fakultetas: ${fakultetas}\nStudijų programa: ${programa}\nStudijų tipas: ${studijuTipas}\nSemestras: ${semestras}\nŠalis: ${salis}\nMiestas: ${miestas}\nRegionas: ${regionas}\nUniversitetas: ${universitetas}\nStudijų kalba: ${kalba}\nQS įvertinimas: ${qsIvertinimas}\nPragyvenimo išlaidos: ${pragyvenimoIslaidos}\n\n`);

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
            // qsIvertinimas: _qsIvertinimas,
            // pragyvenimoIslaidos: _pragyvenimoIslaidos
        };

        //console.log(filters);

        const res = await queryUniversities(filters);

        if (res.length != 0){
            format_and_output(res);
        }
        else {
            console.log("Failed getting query results !!!");
        }

        // Connection to DB to get information
    });
});






// Isikelti visus duom?
// is duomenu susirasti unique rodilkius
// juos sukelti i html.


function find_unique_and_populate_html(res) {
    // find unique universities

    //console.log("test all info", res);


    //Language
    const _language = $('#language');
    const uniqueLanguage = [...new Set(res.flatMap(res => res.kalbos))];
    uniqueLanguage.forEach((el) => {
        _language.append(`<option>${el}</option>`)
    });

    //Countrys
    const _countrys = $('#country');
    const uniqueCountrys = [...new Set(res.map(res => res.salis))];
    //console.log("Unique ids", uniqueCountrys);
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
    // qsIvertinimas: _qsIvertinimas,
    // pragyvenimoIslaidos: _pragyvenimoIslaidos
};///


let all_the_info = []
const res = await queryUniversities(emptyfilters);

if (res.length != 0){
    format_and_output(res);
}
else {
    console.log("Failed getting query results !!!");
}

find_unique_and_populate_html(res)




