import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

document.addEventListener('DOMContentLoaded', function() {
    const btnMenu = document.querySelector('.btn-menu');
    const btnClose = document.querySelector('.btn-close');
    const mobileNavWrapper = document.querySelector('.mobile-nav-wrapper');
    const navLinks = document.querySelectorAll('.mobile-nav-wrapper .nav-link');

    btnMenu.addEventListener('click', function() {
        mobileNavWrapper.style.display = 'flex';
        setTimeout(() => {
            mobileNavWrapper.classList.add('show');
        }, 10);
    });

    function closeMenu() {
        mobileNavWrapper.classList.remove('show');
        setTimeout(() => {
            if (!mobileNavWrapper.classList.contains('show')) {
                mobileNavWrapper.style.display = 'none';
            }
        }, 300);
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

/* alcuni file hanno, insieme agli occhiali, una parte estranea molto più grande di
   loro (una testa su cui sono indossati, o il piedistallo d'appoggio di Rhino):
   la nascondiamo per coerenza con la scheda, che vuole mostrare solo l'occhiale
   (stessa lista usata in catalogo.js) */
const NODI_DA_NASCONDERE = {
    'glb/camilasaraviaruiz.glb': ['testa_sx', 'testa_dx'],
    'glb/federicacancello.glb': ['testa_sx', 'testa_dx'],
    'glb/occhiale-3dm.glb': ['mesh-0']
};

/* diversi file portano con sé anche le linee di quotatura/costruzione del disegno CAD
   originale (fino a 569 segmenti in alcuni casi): non sono triangoli pieni ma segmenti
   (THREE.Line), e si vedono come righe sottili vaganti sullo sfondo — le togliamo da
   ogni modello (stessa pulizia fatta in catalogo.js) */
function rimuoviLineeEPunti(modello) {
    const daRimuovere = [];
    modello.traverse(function(nodo) {
        if (nodo.isLine || nodo.isPoints) {
            daRimuovere.push(nodo);
        }
    });
    daRimuovere.forEach(function(nodo) {
        nodo.parent.remove(nodo);
    });
}

/* stessa palette di default usata in catalogo.js: ai materiali senza nessun colore
   assegnato (niente baseColorFactor, niente texture — restano bianco plastica)
   diamo un colore invece di lasciarli bianchi */
const PALETTE_DEFAULT = ['#ddb892', '#9c6644', '#91171f', '#588157', '#3a5a40', '#6b8aa6', '#caa976', '#413c58'];

/* pannello "Colore per componente": solo 6 colori base da scegliere, niente più
   la famiglia estesa di sfumature */
const PALETTE_SCELTA = [
    { hex: '#7f5539', nome: 'Marrone' },
    { hex: '#2f5d8a', nome: 'Blu' },
    { hex: '#91171f', nome: 'Rosso' },
    { hex: '#3a5a40', nome: 'Verde' },
    { hex: '#6b6b6b', nome: 'Grigio' },
    { hex: '#c9a227', nome: 'Giallo' }
];

function assegnaColoriDiDefault(modello) {
    const materialiVisti = new Set();
    let indice = 0;
    modello.traverse(function(nodo) {
        if (!nodo.isMesh || !nodo.material) {
            return;
        }
        const materiali = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
        materiali.forEach(function(materiale) {
            if (!materiale || !materiale.color || materialiVisti.has(materiale.uuid)) {
                return;
            }
            materialiVisti.add(materiale.uuid);
            // la soglia è volutamente altissima: un baseColorFactor ASSENTE nel file
            // dà sempre bianco ESATTO (1,1,1); un bianco scelto apposta (come il
            // "Plastic" quasi bianco di Anna Porcellini, 0.957) non deve essere toccato
            const eBiancoNonImpostato = materiale.color.r > 0.999 && materiale.color.g > 0.999 && materiale.color.b > 0.999;
            if (eBiancoNonImpostato && !materiale.map) {
                materiale.color.set(PALETTE_DEFAULT[indice % PALETTE_DEFAULT.length]);
                indice += 1;
            }
        });
    });
}

/* stessa sovrascrittura di catalogo.js: alcuni file condividono geometria E colori
   (es. Anna Porcellini e Takwa Guezguez, entrambi bianco e arancione) e qui si
   ricolora il "secondo" membro di ogni coppia perché non sembrino duplicati */
const SOVRASCRIVI_COLORI = {
    'glb/takwaguezguez.glb': ['#2b2b2b', '#588157', null],
    'glb/francescagalli.glb': ['#91171f', '#3a5a40'],
    'glb/giuliacamasso.glb': ['#6b8aa6', '#413c58'],
    'glb/3d_occhiali_giuli.glb': ['#588157', '#7f5539'],
    'glb/lindagarnaroli.glb': ['#ba1f33', '#588157', '#1a1a1a', '#dad7cd', '#6b8aa6'],
    'glb/luigiboccarossa.glb': ['#91171f', null, '#ddb892'],
    'glb/federicacancello.glb': ['#3a5a40', null],
    'glb/SofiaBezzicheri.glb': ['#410b13', '#344e41', '#b08968', '#1a1a1a'],
    'glb/gianmarcotito.glb': ['#9c6644', '#410b13', '#dad7cd'],
    'glb/giacomocerioni.glb': ['#91171f', '#588157', '#1a1a1a'],
    'glb/Jacopo_Del_Bianco.glb': ['#344e41', '#b08968', '#7f5539']
};

function applicaSovrascritturaColori(datasrc, modello) {
    const sovrascrizioni = SOVRASCRIVI_COLORI[datasrc];
    if (!sovrascrizioni) {
        return;
    }
    const materialiVisti = new Set();
    let indice = 0;
    modello.traverse(function(nodo) {
        if (!nodo.isMesh || !nodo.material) {
            return;
        }
        const materiali = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
        materiali.forEach(function(materiale) {
            if (!materiale || !materiale.color || materialiVisti.has(materiale.uuid)) {
                return;
            }
            materialiVisti.add(materiale.uuid);
            const colore = sovrascrizioni[indice];
            if (colore) {
                materiale.color.set(colore);
            }
            indice += 1;
        });
    });
}

/* stesso calcolo di catalogo.js: una sfera centrata sulla media reale dei vertici
   (non sul centro del bounding box), così il modello gira in modo stabile invece
   di oscillare intorno a un perno lontano dalla geometria vera */
function sferaDaiVertici(modello) {
    modello.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const somma = new THREE.Vector3();
    let conteggio = 0;

    modello.traverse(function(nodo) {
        if (!nodo.isMesh) {
            return;
        }
        const posizioni = nodo.geometry.attributes.position;
        if (!posizioni) {
            return;
        }
        for (let i = 0; i < posizioni.count; i++) {
            v.fromBufferAttribute(posizioni, i).applyMatrix4(nodo.matrixWorld);
            somma.add(v);
            conteggio += 1;
        }
    });

    if (conteggio === 0) {
        return new THREE.Sphere(new THREE.Vector3(), 0.0001);
    }

    const centro = somma.divideScalar(conteggio);
    let raggio = 0;

    modello.traverse(function(nodo) {
        if (!nodo.isMesh) {
            return;
        }
        const posizioni = nodo.geometry.attributes.position;
        if (!posizioni) {
            return;
        }
        for (let i = 0; i < posizioni.count; i++) {
            v.fromBufferAttribute(posizioni, i).applyMatrix4(nodo.matrixWorld);
            raggio = Math.max(raggio, v.distanceTo(centro));
        }
    });

    return new THREE.Sphere(centro, Math.max(raggio, 0.0001));
}

/* pannello "Colore per componente": una riga di campioni per ogni materiale colorabile
   del modello appena caricato (i materiali cambiano da file a file, non c'è un set
   fisso di componenti come nel configuratore della lampada) */
function costruisciPannelloColori(modello) {
    const contenitorePannello = document.getElementById('scheda-colori');
    contenitorePannello.innerHTML = '';

    // raggruppati per NOME, non per materiale: alcuni file esportano lo stesso
    // componente logico (es. "Dettaglio") su più materiali distinti con lo stesso
    // nome, e senza questo raggruppamento comparivano due righe identiche una
    // sotto l'altra. I materiali senza nome restano ciascuno la propria riga.
    const gruppi = [];
    const indiceDiGruppo = new Map();
    const visti = new Set();
    modello.traverse(function(nodo) {
        if (!nodo.isMesh || !nodo.material) {
            return;
        }
        const lista = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
        lista.forEach(function(materiale) {
            if (!materiale || !materiale.color || visti.has(materiale.uuid)) {
                return;
            }
            visti.add(materiale.uuid);
            const nome = materiale.name;
            if (nome && indiceDiGruppo.has(nome)) {
                gruppi[indiceDiGruppo.get(nome)].materiali.push(materiale);
                return;
            }
            if (nome) {
                indiceDiGruppo.set(nome, gruppi.length);
            }
            gruppi.push({ nome: nome || null, materiali: [materiale] });
        });
    });

    if (gruppi.length === 0) {
        return;
    }

    const titolo = document.createElement('h3');
    titolo.className = 'opzione-titolo';
    titolo.textContent = 'Personalizza i colori';
    contenitorePannello.appendChild(titolo);

    gruppi.forEach(function(gruppo, indice) {
        const riga = document.createElement('div');
        riga.className = 'settore';

        const nomeRiga = document.createElement('h4');
        nomeRiga.className = 'settore-nome';
        nomeRiga.textContent = gruppo.nome || ('Componente ' + (indice + 1));
        riga.appendChild(nomeRiga);

        PALETTE_SCELTA.forEach(function(colore) {
            const campione = document.createElement('button');
            campione.type = 'button';
            campione.className = 'campione';
            campione.style.backgroundColor = colore.hex;
            campione.title = colore.nome;
            campione.addEventListener('click', function() {
                gruppo.materiali.forEach(function(materiale) {
                    materiale.color.set(colore.hex);
                });
                riga.querySelectorAll('.campione').forEach(function(c) {
                    c.classList.remove('selected');
                });
                campione.classList.add('selected');
            });
            if ('#' + gruppo.materiali[0].color.getHexString() === colore.hex) {
                campione.classList.add('selected');
            }
            riga.appendChild(campione);
        });

        contenitorePannello.appendChild(riga);
    });
}

/* "Misure stimate": i file non portano quote reali, ma un occhiale da vista medio è
   largo circa 14 cm (la stessa stima usata più sotto per la prova virtuale, SCALA_VOLTO)
   — usiamo quel riferimento per convertire il bounding box del modello in centimetri
   plausibili, proporzionati alla sua forma reale */
const LARGHEZZA_RIFERIMENTO_CM = 14;

function mostraMisureStimate(modello) {
    const el = document.getElementById('scheda-misure');
    if (!el) {
        return;
    }
    modello.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(modello);
    const dimensioni = new THREE.Vector3();
    box.getSize(dimensioni);
    if (!(dimensioni.x > 0)) {
        el.textContent = 'Misure non disponibili per questo modello.';
        return;
    }
    const scalaCm = LARGHEZZA_RIFERIMENTO_CM / dimensioni.x;
    const larghezza = (dimensioni.x * scalaCm).toFixed(1);
    const altezza = (dimensioni.y * scalaCm).toFixed(1);
    const profondita = (dimensioni.z * scalaCm).toFixed(1);
    el.textContent = 'Larghezza ' + larghezza + ' cm · Altezza ' + altezza + ' cm · Profondità ' + profondita + ' cm (stima, basata su una larghezza media di 14 cm)';
}

const parametri = new URLSearchParams(window.location.search);
const file = parametri.get('file');

const linkGrafite = document.getElementById('link-grafite');
if (linkGrafite && file === 'glb/federicacancello.glb') {
    linkGrafite.hidden = false;
}

const titoloEl = document.getElementById('scheda-titolo');
const descrizioneEl = document.getElementById('scheda-descrizione');

/* il nome e la descrizione non sono duplicati qui: vengono letti direttamente dalla
   scheda corrispondente in catalogo.html, così c'è un solo posto da aggiornare */
async function caricaTestiDalCatalogo() {
    if (!file) {
        titoloEl.textContent = 'Modello non trovato';
        descrizioneEl.textContent = 'Manca il parametro "file" nell\'indirizzo.';
        return;
    }
    try {
        const risposta = await fetch('catalogo.html');
        const testoHtml = await risposta.text();
        const pagina = new DOMParser().parseFromString(testoHtml, 'text/html');
        const riquadro = pagina.querySelector('.catalogo-viewer[data-src="' + CSS.escape(file) + '"]');
        const scheda = riquadro ? riquadro.closest('.catalogo-card') : null;

        if (!scheda) {
            titoloEl.textContent = 'Modello non trovato';
            descrizioneEl.textContent = 'Non trovo questo file nel catalogo.';
            return;
        }

        const titoloOriginale = scheda.querySelector('.catalogo-titolo');
        const descrizioneOriginale = scheda.querySelector('.catalogo-descrizione');

        document.title = 'Triennale Milano – ' + titoloOriginale.textContent;
        titoloEl.textContent = titoloOriginale.textContent;
        descrizioneEl.innerHTML = descrizioneOriginale.innerHTML;
    } catch (errore) {
        titoloEl.textContent = 'Modello non trovato';
        descrizioneEl.textContent = 'Non riesco a leggere il catalogo in questo momento.';
        console.error('Errore nel leggere catalogo.html:', errore);
    }
}
caricaTestiDalCatalogo();

/* ===== visualizzatore 3D grande, con controlli di orbita ===== */

const contenitore = document.getElementById('visore');

/* stessa logica di inquadratura del catalogo (catalogo.js): il modello viene scalato
   in base al raggio della sfera che lo contiene, e la telecamera sta alla distanza
   minima per cui quella sfera entra sempre nel campo visivo, qualunque sia la
   rotazione — evita che un modello "profondo" venga tagliato mentre gira. */
const RAGGIO_BERSAGLIO = 1;
const FOV_GRADI = 40;
const MARGINE_INQUADRATURA = 1.3; // un po' più largo del catalogo, per lasciare spazio alla rotella di zoom
const DISTANZA_CAMERA = (RAGGIO_BERSAGLIO / Math.sin(THREE.MathUtils.degToRad(FOV_GRADI / 2))) * MARGINE_INQUADRATURA;

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV_GRADI, contenitore.clientWidth / contenitore.clientHeight, 0.01, 1000);
camera.position.set(0, 0, DISTANZA_CAMERA);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(contenitore.clientWidth, contenitore.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// luce e ombra vere (non la vecchia resa piatta/statica): il modello proietta
// un'ombra di contatto leggera sul piano sotto di sé
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
contenitore.appendChild(renderer.domElement);

// alcuni materiali originali (vetro, metallo) usano riflessi/trasmissione e senza un
// ambiente da riflettere risultano quasi del tutto invisibili: questo ambiente generato
// (standard in three.js, non è una foto reale) gli dà qualcosa da riflettere.
const pmrem = new THREE.PMREMGenerator(renderer);
scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scena.add(new THREE.AmbientLight(0xffffff, 0.7));
const luceDirezionale = new THREE.DirectionalLight(0xffffff, 1.3);
luceDirezionale.position.set(3, 6, 4);
luceDirezionale.castShadow = true;
luceDirezionale.shadow.mapSize.set(1024, 1024);
luceDirezionale.shadow.camera.near = 0.1;
luceDirezionale.shadow.camera.far = 20;
luceDirezionale.shadow.camera.left = -2;
luceDirezionale.shadow.camera.right = 2;
luceDirezionale.shadow.camera.top = 2;
luceDirezionale.shadow.camera.bottom = -2;
luceDirezionale.shadow.radius = 4;
scena.add(luceDirezionale);

// piano invisibile che riceve solo l'ombra (ShadowMaterial non si vede altrimenti):
// dà all'oggetto un appoggio reale invece del galleggiamento piatto di prima
const pianoOmbra = new THREE.Mesh(
    new THREE.CircleGeometry(4, 48),
    new THREE.ShadowMaterial({ opacity: 0.25 })
);
pianoOmbra.rotation.x = -Math.PI / 2;
pianoOmbra.position.y = -RAGGIO_BERSAGLIO * 0.95;
pianoOmbra.receiveShadow = true;
scena.add(pianoOmbra);

const controlli = new OrbitControls(camera, renderer.domElement);
controlli.enableDamping = true;
controlli.minDistance = 0.5;
controlli.maxDistance = 10;

let modello = null;
let perno = null; // il gruppo che ruota davvero: vedi commento più sotto
const velocitaRotazione = 0.002; // radianti per frame, come nel catalogo e nella lampada PH5

if (file) {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(encodeURI(file), function(gltf) {
        modello = gltf.scene;

        rimuoviLineeEPunti(modello);

        const daNascondere = NODI_DA_NASCONDERE[file] || [];
        if (daNascondere.length) {
            const nodiTrovati = [];
            modello.traverse(function(nodo) {
                if (daNascondere.includes(nodo.name)) {
                    nodiTrovati.push(nodo);
                }
            });
            nodiTrovati.forEach(function(nodo) {
                nodo.parent.remove(nodo);
            });
        }

        assegnaColoriDiDefault(modello);
        applicaSovrascritturaColori(file, modello);

        modello.traverse(function(nodo) {
            if (nodo.isMesh) {
                nodo.castShadow = true;
                nodo.receiveShadow = true;
            }
        });

        const sfera = sferaDaiVertici(modello);
        const scala = RAGGIO_BERSAGLIO / Math.max(sfera.radius, 0.0001);

        // la scala va applicata prima di calcolare lo spostamento, altrimenti il
        // modello resta spostato di centro·(scala-1) dal centro del riquadro
        // (stessa correzione fatta in catalogo.js)
        modello.scale.setScalar(scala);
        modello.position.copy(sfera.center).multiplyScalar(-scala);

        // un oggetto ruota sempre intorno alla PROPRIA origine locale: se il baricentro
        // del file originale è lontano dall'origine (come in occhiale-3dm.glb), far
        // ruotare "modello" direttamente lo fa orbitare invece che girare su se stesso,
        // e l'orbita può portarlo fuori dall'inquadratura. "perno" sta fermo
        // all'origine ed è lui a ruotare; "modello" dentro di lui è spostato in modo
        // che il suo baricentro coincida esattamente con l'origine di "perno".
        perno = new THREE.Group();
        perno.add(modello);
        scena.add(perno);

        costruisciPannelloColori(modello);
        mostraMisureStimate(modello);

        if (btnApriProva) {
            btnApriProva.hidden = false;
        }
    }, undefined, function(errore) {
        console.error('Errore nel caricamento di ' + file + ':', errore);
        const avviso = document.createElement('p');
        avviso.className = 'catalogo-avviso';
        avviso.textContent = 'Anteprima non disponibile';
        contenitore.appendChild(avviso);
    });
}

function anima() {
    requestAnimationFrame(anima);
    if (perno) {
        perno.rotation.y += velocitaRotazione;
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

/* ===== prova virtuale con la fotocamera =====
   usa MediaPipe FaceLandmarker (riconoscimento del volto che gira interamente nel
   browser: il video non viene mai inviato a un server, né da noi né da MediaPipe)
   per seguire la posa della testa in tempo reale e agganciarci sopra una copia dello
   stesso modello già caricato qui sopra, con gli stessi colori eventualmente scelti
   nel pannello "Personalizza i colori". */

const btnApriProva = document.getElementById('apri-prova-virtuale');
const btnChiudiProva = document.getElementById('chiudi-prova-virtuale');
const pannelloProva = document.getElementById('prova-virtuale');
const videoProva = document.getElementById('prova-video');
const canvasProva = document.getElementById('prova-canvas');
const statoProva = document.getElementById('prova-stato');
const regolazioneProva = document.getElementById('prova-regolazione');
const btnRimpicciolisci = document.getElementById('prova-rimpicciolisci');
const btnIngrandisci = document.getElementById('prova-ingrandisci');
const btnScatta = document.getElementById('prova-scatta');
const risultatoProva = document.getElementById('prova-risultato');
const fotoProva = document.getElementById('prova-foto');
const btnCondividi = document.getElementById('prova-condividi');
const btnScarica = document.getElementById('prova-scarica');
const btnRiprova = document.getElementById('prova-riprova');
const linkWhatsapp = document.getElementById('prova-whatsapp');
const linkTelegram = document.getElementById('prova-telegram');
const btnInstagram = document.getElementById('prova-instagram');

let provaAttiva = false;
let faceLandmarkerPromise = null; // caricato una sola volta, riusato se si riapre
let flussoCamera = null;
let rendererProva = null;
let sceneProva = null;
let cameraProva = null;
let pernoVoltoProva = null; // segue la posa della testa, calcolata da MediaPipe ogni frame
let contenitoreScalaProva = null; // la scala si regola con i pulsanti −/+, serve tenerlo a parte
let ultimaFotoUrl = null;

/* raggio del modello (1, vedi RAGGIO_BERSAGLIO) rispetto a un occhiale vero (~14 cm
   di larghezza): questa costante converte le nostre unità "di inquadratura" in
   centimetri, le stesse unità usate dalla matrice di posa di MediaPipe (verificato
   dal vivo: un volto a ~30 cm dalla camera dà una traslazione Z di circa -30). Con
   un valore in metri (0.07) gli occhiali risultavano scalati di 100 volte più piccoli
   del dovuto e sparivano. È comunque una stima — su alcuni volti/fotocamere può
   servire un piccolo ritocco, per questo c'è anche la regolazione manuale −/+. */
const SCALA_VOLTO = 12;
// piccolo spostamento per far coincidere il centro del modello con il ponte degli
// occhiali sul naso, in centimetri (x destra, y su, z verso la camera)
const SPOSTAMENTO_VOLTO = new THREE.Vector3(0, 1.5, 1);
let moltiplicatoreDimensione = 1;

if (btnApriProva) {
    btnApriProva.addEventListener('click', avviaProvaVirtuale);
}
if (btnChiudiProva) {
    btnChiudiProva.addEventListener('click', chiudiProvaVirtuale);
}
if (btnRimpicciolisci) {
    btnRimpicciolisci.addEventListener('click', function() {
        regolaDimensione(0.92);
    });
}
if (btnIngrandisci) {
    btnIngrandisci.addEventListener('click', function() {
        regolaDimensione(1 / 0.92);
    });
}
if (btnScatta) {
    btnScatta.addEventListener('click', scattaFoto);
}
if (btnRiprova) {
    btnRiprova.addEventListener('click', tornaAllaFotocamera);
}
if (btnScarica) {
    btnScarica.addEventListener('click', scaricaFoto);
}
if (btnCondividi) {
    btnCondividi.addEventListener('click', condividiFoto);
}
if (btnInstagram) {
    // Instagram non ha un indirizzo web per ricevere foto: apriamo lo stesso pannello
    // di condivisione nativo del telefono (funziona anche per WhatsApp/Telegram se
    // preferiti da lì), dove su mobile compare anche Instagram tra le app disponibili
    btnInstagram.addEventListener('click', condividiFoto);
}
// chiudere con Esc, comodo quanto la fotocamera copre tutto lo schermo
window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && provaAttiva) {
        chiudiProvaVirtuale();
    }
});

function regolaDimensione(fattore) {
    moltiplicatoreDimensione *= fattore;
    if (contenitoreScalaProva) {
        contenitoreScalaProva.scale.setScalar(SCALA_VOLTO * moltiplicatoreDimensione);
    }
}

async function caricaFaceLandmarker() {
    if (!faceLandmarkerPromise) {
        faceLandmarkerPromise = (async function() {
            const { FaceLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
            const risolutore = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
            );
            return FaceLandmarker.createFromOptions(risolutore, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'GPU'
                },
                outputFaceBlendshapes: false,
                outputFacialTransformationMatrixes: true,
                runningMode: 'VIDEO',
                numFaces: 1
            });
        })();
    }
    return faceLandmarkerPromise;
}

async function avviaProvaVirtuale() {
    if (!modello || provaAttiva) {
        return;
    }
    provaAttiva = true;
    pannelloProva.hidden = false;
    statoProva.textContent = 'Attivazione della fotocamera…';

    try {
        flussoCamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    } catch (errore) {
        statoProva.textContent = 'Non riesco ad accedere alla fotocamera' + (errore && errore.message ? ': ' + errore.message : '.');
        console.error('Errore nell\'accesso alla fotocamera:', errore);
        return;
    }

    if (!provaAttiva) { // il riquadro è stato chiuso mentre aspettavamo il permesso
        fermaTracce();
        return;
    }

    videoProva.srcObject = flussoCamera;
    await videoProva.play();

    statoProva.textContent = 'Caricamento del riconoscimento del volto…';

    let faceLandmarker;
    try {
        faceLandmarker = await caricaFaceLandmarker();
    } catch (errore) {
        statoProva.textContent = 'Non riesco a caricare il riconoscimento del volto in questo momento.';
        console.error('Errore nel caricare FaceLandmarker:', errore);
        return;
    }

    if (!provaAttiva) {
        fermaTracce();
        return;
    }

    statoProva.textContent = 'Inquadra il tuo viso.';
    impostaScenaProva();
    animaProva(faceLandmarker);
}

function impostaScenaProva() {
    canvasProva.width = videoProva.videoWidth;
    canvasProva.height = videoProva.videoHeight;

    sceneProva = new THREE.Scene();
    // il campo visivo di una webcam non è comunicato dal browser: 63° è una stima
    // ragionevole (tipica di molte webcam integrate), usata solo per far corrispondere
    // la prospettiva del modello virtuale a quella dell'immagine della fotocamera
    cameraProva = new THREE.PerspectiveCamera(63, videoProva.videoWidth / videoProva.videoHeight, 0.01, 100);

    rendererProva = new THREE.WebGLRenderer({ canvas: canvasProva, antialias: true, alpha: true });
    rendererProva.setSize(videoProva.videoWidth, videoProva.videoHeight, false);
    rendererProva.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    sceneProva.add(new THREE.AmbientLight(0xffffff, 1.0));
    const luceProva = new THREE.DirectionalLight(0xffffff, 0.8);
    luceProva.position.set(0, 1, 2);
    sceneProva.add(luceProva);

    // una copia del modello già caricato (con gli stessi materiali: eventuali colori
    // scelti nel pannello qui sopra si vedono anche nella prova virtuale), dentro un
    // gruppo che verrà posizionato e orientato ogni frame secondo la posa del volto
    const copiaModello = modello.clone();
    contenitoreScalaProva = new THREE.Group();
    contenitoreScalaProva.add(copiaModello);
    contenitoreScalaProva.scale.setScalar(SCALA_VOLTO * moltiplicatoreDimensione);
    contenitoreScalaProva.position.copy(SPOSTAMENTO_VOLTO);

    pernoVoltoProva = new THREE.Group();
    pernoVoltoProva.add(contenitoreScalaProva);
    pernoVoltoProva.matrixAutoUpdate = false;
    pernoVoltoProva.visible = false;
    sceneProva.add(pernoVoltoProva);

    if (regolazioneProva) {
        regolazioneProva.hidden = false;
    }
    if (btnScatta) {
        btnScatta.hidden = false;
    }
}

function animaProva(faceLandmarker) {
    if (!provaAttiva) {
        return;
    }
    requestAnimationFrame(function() {
        animaProva(faceLandmarker);
    });

    if (videoProva.readyState >= 2) {
        const risultati = faceLandmarker.detectForVideo(videoProva, performance.now());
        const matrice = risultati.facialTransformationMatrixes;
        if (matrice && matrice.length > 0) {
            pernoVoltoProva.visible = true;
            pernoVoltoProva.matrix.fromArray(matrice[0].data);
            pernoVoltoProva.matrixWorldNeedsUpdate = true;
            statoProva.textContent = '';
        } else {
            pernoVoltoProva.visible = false;
            statoProva.textContent = 'Non trovo un viso: avvicinati e inquadra bene il volto.';
        }
    }

    rendererProva.render(sceneProva, cameraProva);
}

function fermaTracce() {
    if (flussoCamera) {
        flussoCamera.getTracks().forEach(function(traccia) {
            traccia.stop();
        });
        flussoCamera = null;
    }
    videoProva.srcObject = null;
}

function chiudiProvaVirtuale() {
    provaAttiva = false;
    pannelloProva.hidden = true;
    fermaTracce();

    if (rendererProva) {
        rendererProva.dispose();
        rendererProva = null;
    }
    sceneProva = null;
    cameraProva = null;
    pernoVoltoProva = null;
    contenitoreScalaProva = null;
    moltiplicatoreDimensione = 1;

    if (regolazioneProva) {
        regolazioneProva.hidden = true;
    }
    if (btnScatta) {
        btnScatta.hidden = true;
    }
    nascondiRisultatoFoto();
}

/* ===== scatto e condivisione della foto ===== */

function scattaFoto() {
    if (!rendererProva) {
        return;
    }
    try {
        // un render esplicito proprio ora, per essere sicuri che il canvas 3D contenga
        // l'ultimo fotogramma nel momento esatto in cui lo fotografiamo
        rendererProva.render(sceneProva, cameraProva);

        // in alcuni browser videoWidth/videoHeight possono non essere ancora pronti:
        // usiamo le dimensioni del canvas 3D (già valide, impostaScenaProva le imposta
        // sempre) come riserva, invece di creare una foto 0×0 che fallisce in silenzio
        const larghezza = videoProva.videoWidth || canvasProva.width;
        const altezza = videoProva.videoHeight || canvasProva.height;
        if (!larghezza || !altezza) {
            statoProva.textContent = 'La fotocamera non è ancora pronta: riprova tra un istante.';
            return;
        }

        const canvasFoto = document.createElement('canvas');
        canvasFoto.width = larghezza;
        canvasFoto.height = altezza;
        const ctx = canvasFoto.getContext('2d');

        // specchiata come quello che si vede a schermo (video e modello 3D sono
        // mostrati specchiati via CSS, qui li ridisegniamo specchiati allo stesso modo)
        ctx.translate(larghezza, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoProva, 0, 0, larghezza, altezza);
        ctx.drawImage(canvasProva, 0, 0, larghezza, altezza);

        canvasFoto.toBlob(function(blob) {
            if (!blob) {
                statoProva.textContent = 'Non sono riuscito a creare la foto: riprova.';
                console.error('toBlob ha restituito null: impossibile creare la foto.');
                return;
            }
            mostraRisultatoFoto(blob);
        }, 'image/jpeg', 0.92);
    } catch (errore) {
        statoProva.textContent = 'Non sono riuscito a scattare la foto: riprova.';
        console.error('Errore nello scatto della foto:', errore);
    }
}

function mostraRisultatoFoto(blob) {
    if (ultimaFotoUrl) {
        URL.revokeObjectURL(ultimaFotoUrl);
    }
    ultimaFotoUrl = URL.createObjectURL(blob);
    fotoProva.src = ultimaFotoUrl;

    const testoCondivisione = 'Ho provato questi occhiali virtualmente sul catalogo della Triennale Milano';
    const urlPagina = window.location.href;
    linkWhatsapp.href = 'https://wa.me/?text=' + encodeURIComponent(testoCondivisione + ' ' + urlPagina);
    linkTelegram.href = 'https://t.me/share/url?url=' + encodeURIComponent(urlPagina) + '&text=' + encodeURIComponent(testoCondivisione);

    risultatoProva.hidden = false;
}

function nascondiRisultatoFoto() {
    risultatoProva.hidden = true;
    if (ultimaFotoUrl) {
        URL.revokeObjectURL(ultimaFotoUrl);
        ultimaFotoUrl = null;
    }
    fotoProva.removeAttribute('src');
}

function tornaAllaFotocamera() {
    nascondiRisultatoFoto();
}

function scaricaFoto() {
    if (!ultimaFotoUrl) {
        return;
    }
    const link = document.createElement('a');
    link.href = ultimaFotoUrl;
    link.download = 'occhiali-virtuali.jpg';
    link.click();
}

async function condividiFoto() {
    if (!ultimaFotoUrl) {
        return;
    }
    // la Web Share API con i file apre il pannello di condivisione nativo del
    // telefono (Instagram, WhatsApp, Telegram... qualunque app sia installata):
    // è l'unico modo per condividere l'immagine stessa, non solo un link, e
    // funziona principalmente su cellulare. Dove non è disponibile, scarichiamo
    // la foto e la persona la allega a mano nell'app che preferisce.
    try {
        const risposta = await fetch(ultimaFotoUrl);
        const blob = await risposta.blob();
        const file = new File([blob], 'occhiali-virtuali.jpg', { type: 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'I miei occhiali virtuali',
                text: 'Ho provato questi occhiali virtualmente sul catalogo della Triennale Milano'
            });
            return;
        }
    } catch (errore) {
        if (errore && errore.name === 'AbortError') {
            return; // la persona ha chiuso il pannello di condivisione, nessun errore da mostrare
        }
        console.error('Errore nella condivisione:', errore);
    }

    scaricaFoto();
    statoProva.textContent = '';
}
