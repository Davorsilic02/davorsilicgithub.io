import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

document.addEventListener('DOMContentLoaded', function() {
    const btnMenu = document.querySelector('.btn-menu');
    const btnClose = document.querySelector('.btn-close');
    const mobileNavWrapper = document.querySelector('.mobile-nav-wrapper');
    const navLinks = document.querySelectorAll('.mobile-nav-wrapper .nav-link');

    // Assicurati che il display sia flex prima di aggiungere show
    btnMenu.addEventListener('click', function() {
        mobileNavWrapper.style.display = 'flex';
        // Piccolo delay per permettere al display di attivarsi
        setTimeout(() => {
            mobileNavWrapper.classList.add('show');
        }, 10);
    });

    // Chiude il menu mobile
    function closeMenu() {
        mobileNavWrapper.classList.remove('show');
        // Rimuovi display dopo l'animazione
        setTimeout(() => {
            if (!mobileNavWrapper.classList.contains('show')) {
                mobileNavWrapper.style.display = 'none';
            }
        }, 300); // Stesso tempo della transizione CSS
    }

    btnClose.addEventListener('click', closeMenu);

    mobileNavWrapper.addEventListener('click', function(e) {
        let isLink = false;
        navLinks.forEach(function(link) {
            if (link.contains(e.target)) {
                isLink = true;
            }
        });

        if (!isLink) {
            closeMenu();
        }
    });
});

/* ===== codice del visualizzatore 3D ===== */

const contenitore = document.getElementById('visore');

const scena = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, contenitore.clientWidth / contenitore.clientHeight, 0.1, 100);

// punto di vista di partenza: se copi una vista col bottone "Copia vista" e me la incolli,
// sostituisco questi due oggetti con i valori che mi dai
const vistaIniziale = {
    posizione: { x: 2.243, y: -0.448, z: 0.713 },
    target: { x: 0, y: 0, z: 0 }
};

camera.position.set(vistaIniziale.posizione.x, vistaIniziale.posizione.y, vistaIniziale.posizione.z);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(contenitore.clientWidth, contenitore.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
contenitore.appendChild(renderer.domElement);

/* ===== la palette dei colori della lampada: usata sia dai preset Terra/Wine/Leaf che dai settori per componente ===== */
const colori = {
    // famiglia marroni (per l'accostamento Terra)
    'beige-latte': { hex: '#ede0d4', nome: 'Beige latte' },
    'beige-sabbia': { hex: '#e6ccb2', nome: 'Beige sabbia' },
    'beige-miele': { hex: '#ddb892', nome: 'Beige miele' },
    'marrone-cuoio': { hex: '#b08968', nome: 'Marrone cuoio' },
    'marrone-caffe': { hex: '#7f5539', nome: 'Marrone caffè' },
    'marrone-caramello': { hex: '#9c6644', nome: 'Marrone caramello' },
    // famiglia rossi (per l'accostamento Wine)
    'bordeaux-scuro': { hex: '#410b13', nome: 'Bordeaux scuro' },
    'rosso-carminio': { hex: '#ba1f33', nome: 'Rosso carminio' },
    'rosso-mattone': { hex: '#91171f', nome: 'Rosso mattone' },
    // famiglia verdi (per l'accostamento Leaf)
    'grigio-perla': { hex: '#dad7cd', nome: 'Grigio perla' },
    'verde-salvia': { hex: '#a3b18a', nome: 'Verde salvia' },
    'verde-foglia': { hex: '#588157', nome: 'Verde foglia' },
    'verde-bosco': { hex: '#3a5a40', nome: 'Verde bosco' },
    'verde-abete': { hex: '#344e41', nome: 'Verde abete' }
};
const coloreDiPartenza = 'beige-latte';

/* ===== componenti della lampada =====
   colorabili: i pezzi che il visitatore può ridipingere (paralumi, anello, calotta)
   strutturali: le parti metalliche/di collegamento, hanno una propria finitura ma colore fisso */
const partiColorabili = ['paralume_grande', 'paralume_medio', 'paralume_inferiore', 'paralume_superiore', 'anello_riflettore', 'diffusore'];

const nomiParti = {
    paralume_grande: 'Paralume grande',
    paralume_medio: 'Paralume medio',
    paralume_inferiore: 'Paralume inferiore',
    paralume_superiore: 'Paralume superiore',
    anello_riflettore: 'Anello riflettore',
    diffusore: 'Calotta diffusore'
};

const coloreStrutturaDiPartenza = '#2b2b2b';

/* ===== texture procedurali (generate su canvas, senza bisogno di file immagine) =====
   simulano la grana fine della ceramica (gres) e quella morbida della gomma (gommato) */
function creaTexturaRumore(dimensione, ripetizioni, contrasto) {
    const canvas = document.createElement('canvas');
    canvas.width = dimensione;
    canvas.height = dimensione;
    const ctx = canvas.getContext('2d');

    const immagine = ctx.createImageData(dimensione, dimensione);
    for (let i = 0; i < immagine.data.length; i += 4) {
        const valore = Math.max(0, Math.min(255, 190 + (Math.random() - 0.5) * contrasto));
        immagine.data[i] = valore;
        immagine.data[i + 1] = valore;
        immagine.data[i + 2] = valore;
        immagine.data[i + 3] = 255;
    }
    ctx.putImageData(immagine, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(ripetizioni, ripetizioni);
    return texture;
}

const texturaGres = creaTexturaRumore(64, 14, 70); // grana fine e ruvida, per il metallo tipo gres

// texture a sfumatura radiale, usata per il bagliore soffuso della lampadina
function creaTexturaBagliore() {
    const dimensione = 128;
    const canvas = document.createElement('canvas');
    canvas.width = dimensione;
    canvas.height = dimensione;
    const ctx = canvas.getContext('2d');
    const centro = dimensione / 2;

    const gradiente = ctx.createRadialGradient(centro, centro, 0, centro, centro, centro);
    gradiente.addColorStop(0, 'rgba(255, 232, 196, 1)');
    gradiente.addColorStop(0.4, 'rgba(255, 201, 140, 0.55)');
    gradiente.addColorStop(1, 'rgba(255, 201, 140, 0)');

    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, dimensione, dimensione);

    return new THREE.CanvasTexture(canvas);
}

const materialeBagliore = new THREE.SpriteMaterial({
    map: creaTexturaBagliore(),
    color: 0xffd9a8,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

/* ===== Materiale: 3 finiture applicate a TUTTA la lampada (non più una fissa per componente) =====
   (il passaggio Illuminata/Opaca resta un'altra cosa: accende/spegne solo la luce, non cambia mai materiale) */
const finiture = {
    // metallo ruvido, tipo gres: metallico ma con una grana opaca e sabbiata, non lucido a specchio
    'metallo-gres': function(colore) {
        return new THREE.MeshStandardMaterial({
            color: colore,
            metalness: 0.7,
            roughness: 0.55,
            roughnessMap: texturaGres,
            bumpMap: texturaGres,
            bumpScale: 0.01
        });
    },
    // vetro completo: trasparente e visibile, con rifrazione, riflessi lucidi e un velo di opacità
    // che garantisce l'effetto "si vede attraverso" anche senza una mappa ambientale esterna
    'vetro-completo': function(colore) {
        return new THREE.MeshPhysicalMaterial({
            color: colore,
            metalness: 0,
            roughness: 0.05,
            transmission: 0.9,
            thickness: 0.4,
            ior: 1.5,
            clearcoat: 1,
            clearcoatRoughness: 0.02,
            transparent: true,
            opacity: 0.55
        });
    }
};

let finituraAttuale = 'metallo-gres';

function creaMateriale(colore) {
    return finiture[finituraAttuale](colore);
}

// parti: solo i componenti colorabili, con riferimento al loro materiale e colore attuale (usate dai settori e dai preset)
const parti = {};
// meshStrutturali: le parti non colorabili (attacco, bracci, cavo), ricreate anch'esse quando cambia il Materiale
const meshStrutturali = [];

let modelloPH5 = null;
let scalaBase = 1;

// carica il modello 3D della lampada PH5 e lo inserisce nel riquadro .visore
const gltfLoader = new GLTFLoader();

gltfLoader.load('glb/ph5.glb', function(gltf) {
    modelloPH5 = gltf.scene;

    modelloPH5.traverse(function(nodo) {
        if (!nodo.isMesh) {
            return;
        }

        nodo.castShadow = true;

        const colorabile = partiColorabili.includes(nodo.name);
        const colorePartenza = colorabile ? colori[coloreDiPartenza].hex : coloreStrutturaDiPartenza;
        const materiale = creaMateriale(colorePartenza);

        nodo.material = materiale;

        if (colorabile) {
            parti[nodo.name] = { mesh: nodo, materiale: materiale, colore: colorePartenza };
        } else {
            meshStrutturali.push(nodo);
        }
    });

    // centra il modello e lo scala per adattarlo al riquadro
    const box = new THREE.Box3().setFromObject(modelloPH5);
    const dimensione = box.getSize(new THREE.Vector3());
    const centro = box.getCenter(new THREE.Vector3());
    scalaBase = 2 / Math.max(dimensione.x, dimensione.y, dimensione.z);

    modelloPH5.position.sub(centro);
    modelloPH5.scale.setScalar(scalaBase);
    modelloPH5.rotation.y = 0.7;

    // luce calda e soffusa che parte dalla calotta diffusore, dove si troverebbe la lampadina
    // (coordinate nello spazio "grezzo" del modello: seguono automaticamente scala e rotazione del gruppo)
    const posizioneLampadina = new THREE.Vector3(0, 0.0172, 0);

    const luceLampadina = new THREE.PointLight(0xffc999, 1.1, 0, 2);
    luceLampadina.position.copy(posizioneLampadina);
    modelloPH5.add(luceLampadina);

    const spriteBagliore = new THREE.Sprite(materialeBagliore);
    spriteBagliore.position.copy(posizioneLampadina);
    spriteBagliore.scale.set(0.16, 0.16, 1);
    modelloPH5.add(spriteBagliore);

    scena.add(modelloPH5);
});

// pavimento invisibile: riceve solo l'ombra proiettata dal modello
const geometriaPavimento = new THREE.PlaneGeometry(20, 20);
const materialePavimento = new THREE.ShadowMaterial({ opacity: 0.25 });
const pavimento = new THREE.Mesh(geometriaPavimento, materialePavimento);
pavimento.rotation.x = -Math.PI / 2;
pavimento.position.y = -1.6;
pavimento.receiveShadow = true;
scena.add(pavimento);

const luceAmbientale = new THREE.AmbientLight(0xffffff, 0.6);
scena.add(luceAmbientale);

// "Illuminata" = questa luce (in alto a destra, puntata sull'oggetto) è accesa; "Opaca" = è spenta.
// Il bottone Illuminata/Opaca accende/spegne SOLO questa luce: non tocca mai i materiali.
const luceDirezionale = new THREE.DirectionalLight(0xffffff, 1.3);
luceDirezionale.position.set(3, 6, -3);
luceDirezionale.target.position.set(0, 0, 0);
scena.add(luceDirezionale.target);
luceDirezionale.castShadow = true;
luceDirezionale.shadow.mapSize.width = 1024;
luceDirezionale.shadow.mapSize.height = 1024;
luceDirezionale.shadow.camera.near = 0.5;
luceDirezionale.shadow.camera.far = 20;
luceDirezionale.shadow.camera.left = -3;
luceDirezionale.shadow.camera.right = 3;
luceDirezionale.shadow.camera.top = 3;
luceDirezionale.shadow.camera.bottom = -3;
scena.add(luceDirezionale);

// controlli: trascina per girare, rotella per avvicinarti/allontanarti (attivi solo quando il tour è in pausa)
const controlli = new OrbitControls(camera, renderer.domElement);
controlli.enableDamping = true;
controlli.minDistance = 2;
controlli.maxDistance = 8;
controlli.target.set(vistaIniziale.target.x, vistaIniziale.target.y, vistaIniziale.target.z);
controlli.update();

// rotazione lenta e continua del modello, attiva di default (indipendente dal trascinamento del visitatore):
// la telecamera resta sulla vista frontale di vistaIniziale, è il modello a girare su se stesso
const velocitaRotazione = 0.002; // radianti per frame, circa un giro completo al minuto

function anima() {
    requestAnimationFrame(anima);

    if (modelloPH5) {
        modelloPH5.rotation.y += velocitaRotazione;
    }

    controlli.update();
    renderer.render(scena, camera);
}
anima();

window.addEventListener('resize', function() {
    camera.aspect = contenitore.clientWidth / contenitore.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(contenitore.clientWidth, contenitore.clientHeight);
});

/* ===== Materiale: cambia la finitura di TUTTA la lampada, mantenendo i colori già scelti ===== */
const bottoniMateriale = document.querySelectorAll('.materiale');
const materialeValore = document.getElementById('materiale-valore');

function impostaFinitura(idFinitura) {
    finituraAttuale = idFinitura;

    Object.keys(parti).forEach(function(nomeParte) {
        const parte = parti[nomeParte];
        parte.materiale = creaMateriale(parte.colore);
        parte.mesh.material = parte.materiale;
    });

    meshStrutturali.forEach(function(mesh) {
        mesh.material = creaMateriale(coloreStrutturaDiPartenza);
    });
}

bottoniMateriale.forEach(function(bottone) {
    bottone.addEventListener('click', function() {
        impostaFinitura(bottone.dataset.finitura);

        materialeValore.textContent = bottone.textContent;

        bottoniMateriale.forEach(function(b) {
            b.classList.remove('selected');
        });
        bottone.classList.add('selected');
    });
});

/* ===== Terra, Wine, Leaf: 3 combinazioni pronte, ognuna con la propria famiglia di colori ===== */
const accostamenti = {
    terra: { // dal marrone caffè al beige latte
        paralume_grande: 'marrone-caffe',
        paralume_medio: 'beige-sabbia',
        paralume_inferiore: 'beige-miele',
        paralume_superiore: 'marrone-cuoio',
        anello_riflettore: 'marrone-caramello',
        diffusore: 'beige-latte'
    },
    wine: { // alterna le 3 tonalità di rosso su tutti i componenti, per la massima varietà
        paralume_grande: 'rosso-carminio',
        paralume_medio: 'bordeaux-scuro',
        paralume_inferiore: 'rosso-mattone',
        paralume_superiore: 'rosso-carminio',
        anello_riflettore: 'bordeaux-scuro',
        diffusore: 'rosso-mattone'
    },
    leaf: { // verdi dal salvia chiaro al verde abete
        paralume_grande: 'verde-bosco',
        paralume_medio: 'verde-foglia',
        paralume_inferiore: 'verde-salvia',
        paralume_superiore: 'verde-abete',
        anello_riflettore: 'verde-bosco',
        diffusore: 'grigio-perla'
    }
};

const bottoniAccostamento = document.querySelectorAll('.accostamento');
const accostamentoValore = document.getElementById('accostamento-valore');

// imposta il colore di un componente: aggiorna il materiale 3D e, se esiste, la riga del settore in corrispondenza
function impostaColoreParte(nomeParte, idColore) {
    const parte = parti[nomeParte];
    if (!parte) {
        return;
    }

    parte.colore = colori[idColore].hex;
    parte.materiale.color.set(parte.colore);

    const riga = righeSettore[nomeParte];
    if (riga) {
        riga.valoreEl.textContent = colori[idColore].nome;
        riga.elemento.querySelectorAll('.campione').forEach(function(bottone) {
            bottone.classList.toggle('selected', bottone.dataset.idColore === idColore);
        });
    }
}

bottoniAccostamento.forEach(function(bottone) {
    bottone.addEventListener('click', function() {
        const mappaColori = accostamenti[bottone.dataset.accostamento];

        Object.keys(mappaColori).forEach(function(nomeParte) {
            impostaColoreParte(nomeParte, mappaColori[nomeParte]);
        });

        accostamentoValore.textContent = bottone.textContent;

        bottoniAccostamento.forEach(function(b) {
            b.classList.remove('selected');
        });
        bottone.classList.add('selected');
    });
});

/* ===== Colore per componente: una riga di campioni per ogni parte colorabile, per scegliere a piacere ===== */
const contenitoreSettori = document.getElementById('settori-colore');
const righeSettore = {};

partiColorabili.forEach(function(nomeParte) {
    const riga = document.createElement('div');
    riga.className = 'settore';

    const titolo = document.createElement('p');
    titolo.className = 'settore-nome';

    const nome = document.createElement('span');
    nome.textContent = nomiParti[nomeParte];

    const valore = document.createElement('span');
    valore.className = 'opzione-valore';
    valore.textContent = colori[coloreDiPartenza].nome;

    titolo.appendChild(nome);
    titolo.appendChild(valore);
    riga.appendChild(titolo);

    Object.keys(colori).forEach(function(idColore) {
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'campione';
        bottone.style.backgroundColor = colori[idColore].hex;
        bottone.title = colori[idColore].nome;
        if (idColore === coloreDiPartenza) {
            bottone.classList.add('selected');
        }
        bottone.dataset.idColore = idColore;

        bottone.addEventListener('click', function() {
            impostaColoreParte(nomeParte, idColore);

            // un cambio manuale non corrisponde più a un preset fisso
            bottoniAccostamento.forEach(function(b) {
                b.classList.remove('selected');
            });
            accostamentoValore.textContent = '—';
        });

        riga.appendChild(bottone);
    });

    contenitoreSettori.appendChild(riga);
    righeSettore[nomeParte] = { elemento: riga, valoreEl: valore };
});

// ingrandisce/rimpicciolisce il modello trascinando lo slider Grandezza
const sliderGrandezza = document.getElementById('grandezza');
const grandezzaValore = document.getElementById('grandezza-valore');

sliderGrandezza.addEventListener('input', function() {
    const scala = sliderGrandezza.value / 100;
    if (modelloPH5) {
        modelloPH5.scale.setScalar(scala * scalaBase);
    }
    grandezzaValore.textContent = sliderGrandezza.value + '%';
});

// "Illuminata": accende la luce in alto a destra puntata sull'oggetto (si vedono luci/ombre sui materiali).
// "Opaca": la spegne, resta solo la luce ambientale piatta. Non cambia mai i materiali, non c'è trasparenza.
let modalitaIlluminata = true;
const bottoneModalita = document.getElementById('toggle-modalita');

bottoneModalita.addEventListener('click', function() {
    modalitaIlluminata = !modalitaIlluminata;
    luceDirezionale.visible = modalitaIlluminata;
    bottoneModalita.textContent = modalitaIlluminata ? 'Illuminata' : 'Opaca';
});

// copia negli appunti la vista attuale (posizione camera + punto osservato),
// nello stesso formato di "vistaIniziale": si incolla in chat per impostarla come vista di partenza
const bottoneCopiaVista = document.getElementById('copia-vista');

bottoneCopiaVista.addEventListener('click', function() {
    const vista = {
        posizione: {
            x: Number(camera.position.x.toFixed(3)),
            y: Number(camera.position.y.toFixed(3)),
            z: Number(camera.position.z.toFixed(3))
        },
        target: {
            x: Number(controlli.target.x.toFixed(3)),
            y: Number(controlli.target.y.toFixed(3)),
            z: Number(controlli.target.z.toFixed(3))
        }
    };

    const testo = JSON.stringify(vista, null, 2);
    const testoOriginale = bottoneCopiaVista.textContent;

    navigator.clipboard.writeText(testo).then(function() {
        bottoneCopiaVista.textContent = 'Copiato!';
        setTimeout(function() {
            bottoneCopiaVista.textContent = testoOriginale;
        }, 1500);
    }).catch(function() {
        bottoneCopiaVista.textContent = 'Errore copia';
        setTimeout(function() {
            bottoneCopiaVista.textContent = testoOriginale;
        }, 1500);
    });
});
