import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDoc, getDocs, addDoc, serverTimestamp, query, where, doc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
const reports = collection(db, "Reports");

let all_universities = [];
let currentDisplayedResults = []; 
let sortField = "none";
let sortAsc = true;

// Cache configuration
const CACHE_KEY = 'universities_cache';
const CACHE_EXPIRY_KEY = 'universities_cache_expiry';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

function getCurrentUserID() {
    return localStorage.getItem("userName") || "Nežinomas";
}

// Login functionality
function initializeLogin() {
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
        prisijungtiButton.style.display = 'flex';
    }

    // Show login popup
    prisijungtiButton.addEventListener('click', function() {
        loginPopup.style.display = 'flex';
    });

    // Close login popup
    closeButton.addEventListener('click', function() {
        loginPopup.style.display = 'none';
    });

    // Close popup when clicking outside
    loginPopup.addEventListener('click', function(e) {
        if (e.target === loginPopup) {
            loginPopup.style.display = 'none';
        }
    });

    // Handle login submission
    submitLogin.addEventListener('click', function(event) {
        event.preventDefault();

        const userEmail = document.querySelector('#loginPopup input[type="text"]').value;
        const userPassword = document.querySelector('#loginPopup input[type="password"]').value;

        if (!userEmail.trim() || !userPassword.trim()) {
            alert('Įveskite vartotojo vardą ir slaptažodį');
            return;
        }

        const usersRef = collection(db,'Users');
        const q = query(usersRef, where('userName', '==', userEmail));
        
        getDocs(q)
            .then(snapshot => {
                if (!snapshot.empty) {
                    const userDoc = snapshot.docs[0];
                    const userData = userDoc.data();

                    if (userData.password === userPassword) {
                        localStorage.setItem('isLoggedIn', 'true');
                        localStorage.setItem('isAdmin', userData.isAdmin || false);
                        localStorage.setItem('userName', userData.userName);
                        localStorage.setItem('isBlocked', userData.isBlocked || false);

                        profilisButton.style.display = 'flex';
                        prisijungtiButton.style.display = 'none';    
                        loginPopup.style.display = 'none';
                        
                        // Clear input fields
                        document.querySelector('#loginPopup input[type="text"]').value = '';
                        document.querySelector('#loginPopup input[type="password"]').value = '';
                    } else {
                        alert('Neteisingas slaptažodis');
                    }
                } else {
                    alert('Vartotojas nerastas');
                }
            })
            .catch(error => {
                console.error('Error getting user data: ', error);
                alert('Įvyko klaida prisijungiant');
            });
    });
}

// Cache management functions
function isCacheValid() {
    const cacheExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    if (!cacheExpiry) return false;
    return Date.now() < parseInt(cacheExpiry, 10);
}

function getCachedUniversities() {
    if (!isCacheValid()) {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_EXPIRY_KEY);
        return null;
    }
    
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (error) {
            console.error("Error parsing cached universities:", error);
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(CACHE_EXPIRY_KEY);
            return null;
        }
    }
    return null;
}

function cacheUniversities(universities) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(universities));
        localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
        console.log(`Cached ${universities.length} universities for 30 days`);
    } catch (error) {
        console.error("Error caching universities:", error);
        // If storage is full, clear old cache and try again
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_EXPIRY_KEY);
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(universities));
            localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
            console.log(`Cached ${universities.length} universities for 30 days (after clearing old cache)`);
        } catch (secondError) {
            console.error("Failed to cache universities even after clearing:", secondError);
        }
    }
}

async function queryUniversities(filters) {
    try {
        let q = collection(db, "universities");
        let queriesArr = [];
        for (const [field, value] of Object.entries(filters)) {
            if (value !== "-" && value !== "" && value !== null && value !== undefined) {
                if (field === "kalba"){
                    queriesArr.push(where("kalbos", "array-contains", value));
                } else if (field === "fakultetas"){
                    queriesArr.push(where(field, "==", value));
                } else if (field === "salis" || field === "miestas" || field === "regionas" || field === "universitetas") {
                    if (value !== "-") {
                        queriesArr.push(where(field, "==", value));
                    }
                } else if (field === "qsRating") {
                    // We will filter QS after retrieval
                } else {
                    queriesArr.push(where(field, "==", value));
                }
            }
        }
        if (queriesArr.length > 0) {
            q = query(q, ...queriesArr);
        }
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((docu) => {
            results.push({ id: docu.id, ...docu.data() });
        });
        return results;
    } catch (error) {
        console.error("Error querying universities:", error);
        return [];
    }
}

async function loadAllUniversities() {
    // Try to get from cache first
    const cached = getCachedUniversities();
    if (cached && cached.length > 0) {
        console.log(`Loading ${cached.length} universities from cache`);
        return cached;
    }
    
    // If not in cache or cache expired, fetch from Firebase
    console.log("Cache miss or expired, fetching universities from Firebase");
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
    
    try {
        const universities = await queryUniversities(emptyfilters);
        
        // Cache the results if we got any
        if (universities.length > 0) {
            cacheUniversities(universities);
        }
        
        return universities;
    } catch (error) {
        console.error("Error loading universities from Firebase:", error);
        return [];
    }
}

async function loadCommentsForUniversity(universityCode) {
    try {
        const commentsRef = collection(db, "Comments");
        const q = query(commentsRef, where("allowed", "==", true), where("code", "==", universityCode));
        const querySnapshot = await getDocs(q);
        const comments = [];
        querySnapshot.forEach((docu) => {
            const data = docu.data();
            comments.push({
                id: docu.id,
                text: data.commentText,
                userID: data.userID || "Nežinomas",
                messageTime: data.messageTime,
                pinned: data.pinned || false
            });
        });
        const pinnedComments = comments.filter(c => c.pinned);
        const normalComments = comments.filter(c => !c.pinned);
        return [...pinnedComments, ...normalComments];
    } catch (error) {
        console.error("Error loading comments:", error);
        return [];
    }
}

function formatDate(timestamp) {
    if (!timestamp) return "";
    try {
        const date = timestamp.toDate();
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    } catch (error) {
        console.error("Error formatting date:", error);
        return "";
    }
}

function appendCommentsToSection(card, comments) {
    const commentsContainer = card.find(".comments-section");
    commentsContainer.empty();
    if (comments.length === 0) {
        const noComment = $("<div class='comment-item'><strong>Nėra komentarų</strong></div>");
        commentsContainer.append(noComment);
        return;
    }
    comments.forEach(comment => {
        const dateStr = formatDate(comment.messageTime);
        const item = $(`
            <div class="comment-item ${comment.pinned ? 'pinned' : ''}">
                <div class="comment-item-header">
                    <strong>${comment.userID}</strong>
                    <span class="comment-date">${dateStr}</span>
                </div>
                <p>${comment.text}</p>
            </div>
        `);
        commentsContainer.append(item);
    });
}

async function addComment(universityCode, commentText) {
    const userID = getCurrentUserID();
    try {
        await addDoc(collection(db, "Comments"), {
            allowed: true,
            code: universityCode,
            commentText: commentText,
            userID: userID,
            messageTime: serverTimestamp(),
            pinned: false
        });
    } catch (error) {
        console.error("Error adding comment:", error);
        alert("Nepavyko pridėti komentaro");
    }
}

async function fetchAllCountryData(countries) {
    const countryDataMap = {};
    const promises = countries.map(async (countryName) => {
        try {
            const cDocRef = doc(db, "Countries", countryName);
            const cDoc = await getDoc(cDocRef);
            if (!cDoc.exists()) {
                countryDataMap[countryName] = {costOfLiving: '-', rentCost:'-', scholarship:'-'};
            } else {
                const data = cDoc.data();
                countryDataMap[countryName] = {
                    costOfLiving: data.costOfLiving || '-',
                    rentCost: data.rentCost || '-',
                    scholarship: data.scholarship || '-'
                };
            }
        } catch (error) {
            console.error(`Error fetching data for country ${countryName}:`, error);
            countryDataMap[countryName] = {costOfLiving: '-', rentCost:'-', scholarship:'-'};
        }
    });
    await Promise.all(promises);
    return countryDataMap;
}

function parseQSFilter(value, qsVal) {
    if (!value || value === "-") return true; 
    const qsNum = parseInt(qsVal === '-'? '0': qsVal,10);
    if (isNaN(qsNum)) return value === "900+"; // If QS is not a number, only show in 900+ category
    if (value === "1-300") return qsNum>=1 && qsNum<=300;
    if (value === "301-600") return qsNum>=301 && qsNum<=600;
    if (value === "601-900") return qsNum>=601 && qsNum<=900;
    if (value === "900+") return qsNum>=901 || qsNum === 0; // Include unranked universities in 900+
    return true;
}

function valOrZero(val){
    if (val === '-' || val === null || val === undefined || val === '') return 0;
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : num;
}

function sortResults(univs) {
    if (sortField === "none") return [...univs]; // Return copy to avoid mutating original

    return [...univs].sort((a, b) => {
        if (sortField === "alphabet") {
            const nameA = (a.universitetas || '').toLowerCase();
            const nameB = (b.universitetas || '').toLowerCase();
            if (nameA < nameB) return sortAsc? -1 : 1;
            if (nameA > nameB) return sortAsc? 1 : -1;
            return 0;
        } else if (sortField === "cost") {
            const costA = valOrZero(a.countryData?.costOfLiving);
            const costB = valOrZero(b.countryData?.costOfLiving);
            if (costA < costB) return sortAsc? -1 : 1;
            if (costA > costB) return sortAsc? 1 : -1;
            return 0;
        } else if (sortField === "qs") {
            const qsA = valOrZero(a.qs);
            const qsB = valOrZero(b.qs);
            // For QS ranking, lower numbers are better, so we need to reverse the logic
            if (sortAsc) {
                // Ascending: better rankings (lower numbers) first, but 0 (unranked) goes to end
                if (qsA === 0 && qsB === 0) return 0;
                if (qsA === 0) return 1;
                if (qsB === 0) return -1;
                return qsA - qsB;
            } else {
                // Descending: worse rankings (higher numbers) first, 0 (unranked) goes to beginning
                if (qsA === 0 && qsB === 0) return 0;
                if (qsA === 0) return -1;
                if (qsB === 0) return 1;
                return qsB - qsA;
            }
        }
        return 0;
    });
}

async function format_and_output(res){
    const out = $("#resOutput");
    out.empty();

    if (!res || res.length === 0) {
        out.append("<p>Nėra rezultatų pagal pasirinktus filtrus.</p>");
        $(".results-count").text("Rezultatų: 0");
        return;
    }

    const livingCostsMax = parseInt($("#livingCosts").val() || "0", 10);
    const qsFilterVal = $("#qsRating").val();

    const filteredByQS = res.filter(u => {
        return parseQSFilter(qsFilterVal, u.qs || '-');
    });

    const uniqueCountries = new Set();
    for (let univ of filteredByQS) {
        if (univ.salis) uniqueCountries.add(univ.salis);
    }

    const countryDataMap = await fetchAllCountryData(Array.from(uniqueCountries));

    const filteredResults = [];
    for (let univ of filteredByQS) {
        const countryData = countryDataMap[univ.salis] || {costOfLiving:'-',rentCost:'-',scholarship:'-'};
        const costOfLivingVal = valOrZero(countryData.costOfLiving);
        if (livingCostsMax === 0 || costOfLivingVal <= livingCostsMax) {
            filteredResults.push({...univ, countryData});
        }
    }

    currentDisplayedResults = filteredResults; 
    const sorted = sortResults(currentDisplayedResults);
    const placeholder_img = '../assets/placeholder.png'

    $(".results-count").text(`Rezultatų: ${sorted.length}`);

    for (let u of sorted) {
        const univ = u;
        const image = univ.imageUrl || placeholder_img;
        const countryCity = (univ.salis || '') + (univ.miestas ? ', ' + univ.miestas : '');
        const langs = (univ.kalbos || []).join(', ') || '-';
        const qs = univ.qs || '-';
        const costOfLiving = univ.countryData?.costOfLiving || '-';
        const rentCost = univ.countryData?.rentCost || '-';
        const scholarship = univ.countryData?.scholarship || '-';

        const card = $(`
            <div class="university-card">
                <div class="university-card-header">
                    <img src="${image}" alt="Univ Image" onerror="this.src=${placeholder_img}">
                    <div>
                        <h4 style="margin:0;">${univ.universitetas || 'N/A'}</h4>
                        <small>${countryCity}</small>
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
                            <p>${langs}</p>
                            <h5>Studijų lygis</h5>
                            <p>${univ.studijuTipas || '-'}</p>
                            <h5>URL</h5>
                            <a href="${univ.url || '#'}" target="_blank" rel="noopener noreferrer">${univ.url || 'N/A'}</a>
                        </div>
                        <div class="university-details-column">
                            <h5>Pragyvenimo išlaidos</h5>
                            <p>${costOfLiving}</p>
                            <h5>Nuomos kaina</h5>
                            <p>${rentCost}</p>
                            <h5>Stipendija</h5>
                            <p>${scholarship}</p>
                            <h5 style="margin-top:1.5rem;">QS Įvertinimas</h5>
                            <div class="qs-rank-badge">
                                <div class="rank-num">${qs}</div>
                                <span>Rank</span>
                            </div>
                        </div>
                        <div class="university-details-column">
                            <button class="btn btn-danger btn-sm report-error-btn">Pranešti klaidą</button>
                            <h5 style="margin-top:1.5rem;">Komentarai</h5>
                            <div class="comments-section"></div>
                            <div class="comment-input">
                                <input type="text" placeholder="Rašyti komentarą..." class="new-comment-input"/>
                                <button class="btn btn-primary btn-sm send-comment-btn">Siųsti</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Handle card expansion
        card.on('click', async function(e) {
            if (!$(e.target).closest('button, input, .comments-section, .comment-input, a').length) {
                $(this).toggleClass('expanded');
                if ($(this).hasClass('expanded')) {
                    const comments = await loadCommentsForUniversity(univ.universitetas || univ.id);
                    appendCommentsToSection(card, comments);
                }
            }
        });

        // Handle error reporting
        card.find('.report-error-btn').on('click', async function(event){
            event.stopPropagation();
            const universitetas = univ.universitetas || univ.id || 'Unknown';
            const userInput = prompt("Aprašykite klaidą:", "");
            if (userInput !== null && userInput.trim() !== "") {
                try {
                    const reportData = {
                        kodas: universitetas,
                        message: userInput.trim(),
                        messageTime: serverTimestamp(),
                        userId: localStorage.getItem('userName') || "Anonymous"
                    }
                    await addDoc(collection(db, "Reports"), reportData);
                    alert("Klaida pranešta sėkmingai!");
                } catch (e) {
                    console.error("Error adding report: ", e);
                    alert("Nepavyko pranešti klaidos. Bandykite dar kartą.");
                }
            }
        });

        // Handle comment submission
        card.find('.send-comment-btn').on('click', async function(e){
            e.stopPropagation();
            const commentInput = card.find('.new-comment-input');
            const text = commentInput.val().trim();
            if (text) {
                await addComment(univ.universitetas || univ.id, text);
                const comments = await loadCommentsForUniversity(univ.universitetas || univ.id);
                appendCommentsToSection(card, comments);
                commentInput.val("");
            }
        });

        // Allow Enter key to submit comments
        card.find('.new-comment-input').on('keypress', function(e) {
            if (e.which === 13) { // Enter key
                card.find('.send-comment-btn').click();
            }
        });

        out.append(card);
    }
}

$(document).ready(async function () {
    initializeLogin();

    try {
        let res = await loadAllUniversities();
        all_universities = res;

        if (res.length !== 0) {
            await format_and_output(res);
            find_unique_and_populate_html(res); 
        } else {
            console.warn("No universities found on initial load");
            $("#resOutput").append("<p>Nerasta jokių rezultatų.</p>");
        }
    } catch (error) {
        console.error("Klaida kraunant universitetus:", error);
        $("#resOutput").append("<p>Klaida kraunant duomenis. Bandykite dar kartą.</p>");
    }

    $('button.btn-primary').on('click', async function () {
        const filters = {
            fakultetas: $('#faculty').val() || "-",
            programa: $('#program').val() || "-",
            studijuTipas: $('#studyType').val() || "-",
            semestras: $('#semester').val() || "-",
            salis: $('#country').val() || "-",
            miestas: $('#city').val() || "-",
            regionas: $('#region').val() || "-",
            universitetas: $('#university').val() || "-",
            kalba: $('#language').val() || "-",
            qsRating: $('#qsRating').val()
        };

        try {
            const res = await queryUniversities(filters);
            all_universities = res;

            if (res.length !== 0) {
                await format_and_output(res);
            } else {
                $("#resOutput").empty().append("<p>Nerasta jokių rezultatų pagal pasirinktus filtrus.</p>");
            }
        } catch (error) {
            console.error("Klaida filtruojant universitetus:", error);
            $("#resOutput").append("<p>Klaida filtruojant duomenis.</p>");
        }
    });

    $('#sortField').on('change', function () {
        sortField = $(this).val();
        reSortAndDisplay();
    });

    $('#toggleSortOrder').on('click', function () {
        sortAsc = !sortAsc;
        $(this).text(sortAsc ? "Didėjančia tvarka" : "Mažėjančia tvarka"); //
        reSortAndDisplay();
    });

    function reSortAndDisplay() {
        format_and_output(currentDisplayedResults);
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
});