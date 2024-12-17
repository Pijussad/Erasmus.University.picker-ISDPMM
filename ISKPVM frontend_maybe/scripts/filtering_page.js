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

const reports = collection(db, "Reports");

let all_universities = [];

function getCurrentUserID() {
    return "Nežinomas";
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
        querySnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() });
        });
        return results;
    } catch (error) {
        console.error("Error querying universities:", error);
        return [];
    }
}

async function loadCommentsForUniversity(universityCode) {
    const commentsRef = collection(db, "Comments");
    const q = query(commentsRef, where("allowed", "==", true), where("code", "==", universityCode));
    const querySnapshot = await getDocs(q);
    const comments = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        comments.push({
            id: doc.id,
            text: data.commentText,
            userID: data.userID || "Nežinomas",
            messageTime: data.messageTime,
            pinned: data.pinned || false
        });
    });

    const pinnedComments = comments.filter(c => c.pinned);
    const normalComments = comments.filter(c => !c.pinned);
    return [...pinnedComments, ...normalComments];
}

function formatDate(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
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
    await addDoc(collection(db, "Comments"), {
        allowed: true,
        code: universityCode,
        commentText: commentText,
        userID: userID,
        messageTime: serverTimestamp(),
        pinned: false
    });
}

function format_and_output(res){
    const out = $("#resOutput");
    out.empty();
    $(".results-count").text(`Rezultatų: ${res.length}`);
    res.forEach((univ) => {
        const image = univ.imageUrl || 'https://via.placeholder.com/60';
        const countryCity = (univ.salis || '') + (univ.miestas ? ', ' + univ.miestas : '');
        const langs = (univ.kalbos || []).join(', ') || '-';
        const pragyvenimoIslaidos = univ.pragyvenimoIslaidos || '-';
        const stipendija = univ.stipendija || '-';
        const qsRank = univ.qsRank || 45; // fallback if not provided

        const card = $(`
            <div class="university-card">
                <div class="university-card-header">
                    <img src="${image}" alt="Univ Image">
                    <div>
                        <h4 style="margin:0;">${univ.universitetas}</h4>
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
                        </div>
                        <div class="university-details-column">
                            <h5>Studijų lygis</h5>
                            <p>${univ.studijuTipas || '-'}</p>
                            <h5>URL</h5>
                            <a href="${univ.url || '#'}" target="_blank">${univ.url || 'N/A'}</a>
                            <h5>Pragyvenimo išlaidos</h5>
                            <p>${pragyvenimoIslaidos}</p>
                            <h5>Stipendija</h5>
                            <p>${stipendija}</p>
                            <h5 style="margin-top:1.5rem;">QS Rank</h5>
                            <div class="qs-rank-badge">
                                <div class="rank-num">${qsRank}</div>
                                <span>Rank</span>
                            </div>
                        </div>
                        <div class="university-details-column">
                            <button id="pranestiKlaida" class="btn btn-danger btn-sm">Pranešti klaidą</button>
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

        card.on('click', async function(e) {
            if (!$(e.target).closest('button, input, .comments-section, .comment-input, a').length) {
                $(this).toggleClass('expanded');
                if ($(this).hasClass('expanded')) {
                    const comments = await loadCommentsForUniversity(univ.universitetas);
                    appendCommentsToSection(card, comments);
                }
            }
        });

        card.find('#pranestiKlaida').on('click', async function(event){
            event.stopPropagation();
            const universitetas = univ.universitetas;
            const userInput = prompt("Aprašykite klaidą", "nothing");
            if (userInput !== null) {
                try {
                    const reportData = {
                        kodas: universitetas,
                        message: userInput,
                        messageTime: serverTimestamp(),
                        userId: "idk"
                    }
                    await addDoc(collection(db, "Reports"), reportData);
                }
                catch (e) {
                    console.error("Error adding report: ", e);
                }
            }
        });

        card.find('.send-comment-btn').on('click', async function(e){
            e.stopPropagation();
            const commentInput = card.find('.new-comment-input');
            const text = commentInput.val().trim();
            if (text) {
                await addComment(univ.universitetas, text);
                const comments = await loadCommentsForUniversity(univ.universitetas);
                appendCommentsToSection(card, comments);
                commentInput.val("");
            }
        });

        out.append(card);
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
    all_universities = res;
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
