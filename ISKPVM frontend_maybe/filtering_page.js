

// Obtaining information from filter page options

$(document).ready(function () {




    $('#filters-form').on('submit', function (event) {
        event.preventDefault(); 

        const fakultetas = $('#faculty').val();
        const programa = $('#program').val();
        const studijuTipas = $('#studyType').val();
        const semestras = $('#semester').val();
        const salis = $('#country').val();
        const miestas = $('#city').val();
        const regionas = $('#region').val();
        const universitetas = $('#university').val();
        const kalba = $('#language').val();
        const qsIvertinimas = $('#qsRating').val();
        const pragyvenimoIslaidos = $('#livingCosts').val();

        console.log(`Fakultetas: ${fakultetas}\nStudijų programa: ${programa}\nStudijų tipas: ${studijuTipas}\nSemestras: ${semestras}\nŠalis: ${salis}\nMiestas: ${miestas}\nRegionas: ${regionas}\nUniversitetas: ${universitetas}\nStudijų kalba: ${kalba}\nQS įvertinimas: ${qsIvertinimas}\nPragyvenimo išlaidos: ${pragyvenimoIslaidos}\n\n`);


        // Connection to DB to get information
    });
});