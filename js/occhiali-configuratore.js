import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

/* ===== codice del visualizzatore 3D (stessa struttura usata per la lampada PH5) ===== */

const contenitore = document.getElementById('visore');

const scena = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, contenitore.clientWidth / contenitore.clientHeight, 0.1, 100);

// punto di vista di partenza: se copi una vista col bottone "Copia vista" e me la incolli,
// sostituisco questi due oggetti con i valori che mi dai
const vistaIniziale = {
    posizione: { x: 4.025, y: -0.804, z: 1.279 },
    target: { x: 0, y: 0, z: 0 }
};

camera.position.set(vistaIniziale.posizione.x, vistaIniziale.posizione.y, vistaIniziale.posizione.z);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(contenitore.clientWidth, contenitore.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
contenitore.appendChild(renderer.domElement);

/* ===== la palette dei colori: stessa identica tavolozza usata per la lampada ===== */
const colori = {
    // famiglia marroni (4, da chiaro a scuro)
    'beige-latte': { hex: '#ede0d4', nome: 'Beige latte' },
    'beige-miele': { hex: '#ddb892', nome: 'Beige miele' },
    'marrone-cuoio': { hex: '#b08968', nome: 'Marrone cuoio' },
    'marrone-caffe': { hex: '#7f5539', nome: 'Marrone caffè' },
    // famiglia rossi (4, da chiaro a scuro)
    'rosso-pesca': { hex: '#e5989b', nome: 'Rosso pesca' },
    'rosso-carminio': { hex: '#ba1f33', nome: 'Rosso carminio' },
    'rosso-mattone': { hex: '#91171f', nome: 'Rosso mattone' },
    'bordeaux-scuro': { hex: '#410b13', nome: 'Bordeaux scuro' },
    // famiglia verdi (4, da chiaro a scuro)
    'verde-salvia': { hex: '#a3b18a', nome: 'Verde salvia' },
    'verde-foglia': { hex: '#588157', nome: 'Verde foglia' },
    'verde-bosco': { hex: '#3a5a40', nome: 'Verde bosco' },
    'verde-abete': { hex: '#344e41', nome: 'Verde abete' },
    // famiglia neri/grigi (4, da chiaro a scuro)
    'grigio-perla': { hex: '#dad7cd', nome: 'Grigio perla' },
    'grigio-nebbia': { hex: '#b5b0a6', nome: 'Grigio nebbia' },
    'grigio-antracite': { hex: '#58544c', nome: 'Grigio antracite' },
    'nero-opaco': { hex: '#211f1c', nome: 'Nero opaco' },
    // famiglia blu/azzurri (4, da chiaro a scuro)
    'azzurro-bruma': { hex: '#b8ccd1', nome: 'Azzurro bruma' },
    'azzurro-polvere': { hex: '#7fa3ad', nome: 'Azzurro polvere' },
    'blu-petrolio': { hex: '#3c6e78', nome: 'Blu petrolio' },
    'blu-notte': { hex: '#1f3b42', nome: 'Blu notte' }
};
const coloreDiPartenza = 'beige-latte';

/* ===== componenti degli occhiali =====
   il file esportato non porta nomi leggibili sui singoli pezzi (sono tutti "mesh-N"), quindi li ho
   identificati uno per uno dai materiali/posizioni originali di Rhino e raggruppati in 4 parti colorabili:
   la montatura (frontale + stanghette), le lenti, il dettaglio decorativo e le cerniere/minuterie metalliche.
   Il "mesh-0" (la base di appoggio su cui sono fotografati gli occhiali) resta fisso, come le parti
   strutturali della lampada. */
const gruppiColorabili = {
    montatura: ['mesh-1', 'mesh-2', 'mesh-5', 'mesh-6', 'mesh-11', 'mesh-17', 'mesh-18'],
    lenti: ['mesh-4'],
    dettaglio: ['mesh-3'],
    cerniere: ['mesh-9', 'mesh-14', 'mesh-7', 'mesh-8', 'mesh-10', 'mesh-12', 'mesh-13', 'mesh-15', 'mesh-16']
};

const nomiGruppi = {
    montatura: 'Montatura',
    lenti: 'Lenti',
    dettaglio: 'Dettaglio',
    cerniere: 'Cerniere'
};

// da nome-nodo a id-gruppo colorabile, per sapere a quale parte appartiene ogni mesh durante il caricamento
const nodoAGruppo = {};
Object.keys(gruppiColorabili).forEach(function(idGruppo) {
    gruppiColorabili[idGruppo].forEach(function(nomeNodo) {
        nodoAGruppo[nomeNodo] = idGruppo;
    });
});

/* ===== materiali: un materiale "vero" diverso per ogni componente, non più una finitura unica
   applicata a tutto l'oggetto. Il colore scelto dall'utente (per componente o da una combinazione
   pronta) va solo a tingere queste basi, non ne cambia il tipo. ===== */
const materialiGruppo = {
    // montatura: plastica opaca, tipica di una montatura iniettata
    montatura: function(colore) {
        return new THREE.MeshStandardMaterial({
            color: colore,
            metalness: 0,
            roughness: 0.5
        });
    },
    // lenti: materiale da lenti per occhiali, trasparente e leggermente rifrattivo
    lenti: function(colore) {
        return new THREE.MeshPhysicalMaterial({
            color: colore,
            metalness: 0,
            roughness: 0.05,
            transmission: 0.9,
            thickness: 0.4,
            ior: 1.53,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
            transparent: true,
            opacity: 1
        });
    },
    // dettaglio: plastica lucida, con un velo trasparente che dà il riflesso "a specchio"
    dettaglio: function(colore) {
        return new THREE.MeshPhysicalMaterial({
            color: colore,
            metalness: 0,
            roughness: 0.12,
            clearcoat: 1,
            clearcoatRoughness: 0.06
        });
    },
    // cerniere: la minuteria metallica che tiene insieme montatura e stanghette
    cerniere: function(colore) {
        return new THREE.MeshStandardMaterial({
            color: colore,
            metalness: 0.85,
            roughness: 0.3
        });
    }
};

function creaMaterialeGruppo(idGruppo, colore) {
    return materialiGruppo[idGruppo](colore);
}

// parti: una voce per ogni GRUPPO colorabile, con tutte le sue mesh e il materiale condiviso tra loro
const parti = {};

let modelloOcchiali = null;
let scalaBase = 1;
let centroModello = new THREE.Vector3();

// pivot centrato nell'origine: il modello viene centrato AL SUO INTERNO (position/scale), mentre
// la rotazione continua va applicata al pivot, altrimenti ruotando attorno all'origine "grezza"
// del gruppo il centro vero degli occhiali si allontanerebbe periodicamente dall'inquadratura
const pivotOcchiali = new THREE.Group();
scena.add(pivotOcchiali);

/* ===== vista esplosa: ogni pezzo si allontana dal centro del modello lungo la propria direzione
   radiale, o vi ritorna, a seconda della modalità scelta col bottone "Vista esplosa/assemblata".
   Il passaggio tra le due modalità è animato (non uno scatto secco). ===== */
const pezziEsplosione = [];
const DISTANZA_ESPLOSIONE = 0.6; // distanza massima raggiunta da un pezzo, nello spazio del visore
const DURATA_TRANSIZIONE_ESPLOSIONE = 1200; // millisecondi per passare da una modalità all'altra

let vistaEsplosa = false;
let ampiezzaEsplosione = 0; // 0 = pezzi assemblati, 1 = pezzi esplosi: valore animato ad ogni fotogramma
let transizioneEsplosioneInizio = 0;
let transizioneEsplosioneDa = 0;
let transizioneEsplosioneA = 0;

// carica gli occhiali (convertiti da "occhiale-3dm.3dm") e li inserisce nel riquadro .visore
const gltfLoader = new GLTFLoader();

gltfLoader.load('glb/occhiale-3dm.glb', function(gltf) {
    modelloOcchiali = gltf.scene;

    modelloOcchiali.traverse(function(nodo) {
        if (!nodo.isMesh) {
            return;
        }

        // "mesh-0" è il piano/piedistallo d'appoggio su cui erano fotografati gli occhiali in Rhino:
        // è enormemente più grande degli occhiali stessi (1287x480x1287 contro ~333 di diagonale),
        // quindi una volta applicata la stessa scala finirebbe per inghiottire la camera. Resta
        // nella gerarchia (per coerenza) ma non va mai mostrato in questo visore ravvicinato.
        if (nodo.name === 'mesh-0') {
            nodo.visible = false;
            return;
        }

        nodo.castShadow = true;
        nodo.receiveShadow = true;

        const idGruppo = nodoAGruppo[nodo.name];
        if (!idGruppo) {
            return;
        }

        if (!parti[idGruppo]) {
            const colorePartenza = colori[coloreDiPartenza].hex;
            parti[idGruppo] = { mesh: [], materiale: creaMaterialeGruppo(idGruppo, colorePartenza), colore: colorePartenza };
        }
        nodo.material = parti[idGruppo].materiale;
        parti[idGruppo].mesh.push(nodo);
    });

    // centra il modello e lo scala per adattarlo al riquadro: la base di appoggio ("mesh-0") viene
    // esclusa dal calcolo, altrimenti sposterebbe il centro verso il basso, lontano dagli occhiali.
    // nello stesso giro salvo anche il centro di ogni singolo pezzo, per calcolare poi la direzione
    // in cui farlo "esplodere".
    const box = new THREE.Box3();
    const centriPezzi = [];
    modelloOcchiali.traverse(function(nodo) {
        if (nodo.isMesh && nodo.name !== 'mesh-0') {
            box.expandByObject(nodo);
            const boxPezzo = new THREE.Box3().expandByObject(nodo);
            centriPezzi.push({ nodo: nodo, centro: boxPezzo.getCenter(new THREE.Vector3()) });
        }
    });
    const dimensione = box.getSize(new THREE.Vector3());
    box.getCenter(centroModello);
    scalaBase = 2 / Math.max(dimensione.x, dimensione.y, dimensione.z);

    modelloOcchiali.scale.setScalar(scalaBase);
    modelloOcchiali.position.set(-centroModello.x * scalaBase, -centroModello.y * scalaBase, -centroModello.z * scalaBase);

    centriPezzi.forEach(function(voce) {
        const direzione = voce.centro.clone().sub(centroModello);
        if (direzione.lengthSq() < 1e-6) {
            direzione.set(0, 0, 1); // pezzo esattamente al centro: direzione di riserva
        }
        direzione.normalize();
        // la distanza va espressa nello spazio LOCALE del nodo (prima della scala del modello),
        // perché è lì che imposteremo la sua position ad ogni fotogramma
        pezziEsplosione.push({ nodo: voce.nodo, direzione: direzione, distanza: DISTANZA_ESPLOSIONE / scalaBase });
    });

    pivotOcchiali.add(modelloOcchiali);
    pivotOcchiali.rotation.y = 0.7;
}, undefined, function(errore) {
    console.error('Errore nel caricamento di occhiale-3dm.glb:', errore);
    const messaggio = document.createElement('p');
    messaggio.className = 'visore-segnaposto';
    messaggio.textContent = 'Errore nel caricamento del modello 3D degli occhiali (vedi console).';
    contenitore.appendChild(messaggio);
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

// controlli: trascina per girare, rotella per avvicinarti/allontanarti
const controlli = new OrbitControls(camera, renderer.domElement);
controlli.enableDamping = true;
controlli.minDistance = 2;
controlli.maxDistance = 8;
controlli.target.set(vistaIniziale.target.x, vistaIniziale.target.y, vistaIniziale.target.z);
controlli.update();

// rotazione lenta e continua del modello, attiva di default (indipendente dal trascinamento del visitatore)
const velocitaRotazione = 0.002; // radianti per frame, circa un giro completo al minuto

function anima() {
    requestAnimationFrame(anima);

    if (modelloOcchiali) {
        pivotOcchiali.rotation.y += velocitaRotazione;
    }

    if (pezziEsplosione.length > 0) {
        const progresso = Math.min(1, (performance.now() - transizioneEsplosioneInizio) / DURATA_TRANSIZIONE_ESPLOSIONE);
        const progressoAttenuato = progresso * progresso * (3 - 2 * progresso); // smoothstep: parte e arriva morbida
        ampiezzaEsplosione = transizioneEsplosioneDa + (transizioneEsplosioneA - transizioneEsplosioneDa) * progressoAttenuato;

        pezziEsplosione.forEach(function(pezzo) {
            pezzo.nodo.position.set(
                pezzo.direzione.x * pezzo.distanza * ampiezzaEsplosione,
                pezzo.direzione.y * pezzo.distanza * ampiezzaEsplosione,
                pezzo.direzione.z * pezzo.distanza * ampiezzaEsplosione
            );
        });
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

// imposta il colore di un gruppo: aggiorna il materiale 3D condiviso e, se esiste, la riga del settore
function impostaColoreParte(idGruppo, idColore) {
    const parte = parti[idGruppo];
    if (!parte) {
        return;
    }

    parte.colore = colori[idColore].hex;
    parte.materiale.color.set(parte.colore);

    const riga = righeSettore[idGruppo];
    if (riga) {
        riga.valoreEl.textContent = colori[idColore].nome;
        riga.elemento.querySelectorAll('.campione').forEach(function(bottone) {
            bottone.classList.toggle('selected', bottone.dataset.idColore === idColore);
        });
    }
}

/* ===== Combinazioni colore: 5 abbinamenti pronti, costruiti con i colori già in tavolozza.
   Ogni combinazione è un cerchio con una sfumatura continua tra i suoi colori. ===== */
const combinazioniColore = {
    terra: { nome: 'Terra', colori: { montatura: 'marrone-caffe', lenti: 'beige-miele', dettaglio: 'beige-latte', cerniere: 'marrone-cuoio' } },
    wine: { nome: 'Wine', colori: { montatura: 'rosso-carminio', lenti: 'bordeaux-scuro', dettaglio: 'rosso-mattone', cerniere: 'bordeaux-scuro' } },
    leaf: { nome: 'Leaf', colori: { montatura: 'verde-bosco', lenti: 'verde-salvia', dettaglio: 'grigio-perla', cerniere: 'verde-abete' } },
    grafite: { nome: 'Grafite', colori: { montatura: 'grigio-antracite', lenti: 'nero-opaco', dettaglio: 'grigio-nebbia', cerniere: 'nero-opaco' } },
    oceano: { nome: 'Oceano', colori: { montatura: 'blu-petrolio', lenti: 'blu-notte', dettaglio: 'azzurro-bruma', cerniere: 'blu-petrolio' } }
};

const contenitoreCombinazioni = document.getElementById('combinazioni-colore');
const combinazioneValore = document.getElementById('combinazione-valore');
const bottoniCombinazione = [];

Object.keys(combinazioniColore).forEach(function(idCombinazione) {
    const combinazione = combinazioniColore[idCombinazione];
    const mappaColori = combinazione.colori;

    // sfumatura che passa in sequenza per i colori dei 4 gruppi e si richiude sul primo,
    // così il cerchio mostra una transizione continua invece di 4 spicchi netti
    const tappeColore = ['montatura', 'lenti', 'dettaglio', 'cerniere'].map(function(idGruppo) {
        return colori[mappaColori[idGruppo]].hex;
    });
    tappeColore.push(tappeColore[0]);
    const sfumatura = 'conic-gradient(' + tappeColore.join(', ') + ')';

    const bottone = document.createElement('button');
    bottone.type = 'button';
    bottone.className = 'combinazione-colore';
    bottone.style.background = sfumatura;
    bottone.title = combinazione.nome;
    bottone.dataset.idCombinazione = idCombinazione;

    bottone.addEventListener('click', function() {
        Object.keys(mappaColori).forEach(function(idGruppo) {
            impostaColoreParte(idGruppo, mappaColori[idGruppo]);
        });

        combinazioneValore.textContent = combinazione.nome;

        bottoniCombinazione.forEach(function(b) {
            b.classList.remove('selected');
        });
        bottone.classList.add('selected');
    });

    bottoniCombinazione.push(bottone);
    contenitoreCombinazioni.appendChild(bottone);
});

/* ===== Colore per componente: una riga di campioni per ognuno dei 4 gruppi colorabili ===== */
const contenitoreSettori = document.getElementById('settori-colore');
const righeSettore = {};

Object.keys(gruppiColorabili).forEach(function(idGruppo) {
    const riga = document.createElement('div');
    riga.className = 'settore';

    const titolo = document.createElement('p');
    titolo.className = 'settore-nome';

    const nome = document.createElement('span');
    nome.textContent = nomiGruppi[idGruppo];

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
            impostaColoreParte(idGruppo, idColore);

            bottoniCombinazione.forEach(function(b) {
                b.classList.remove('selected');
            });
            combinazioneValore.textContent = '—';
        });

        riga.appendChild(bottone);
    });

    contenitoreSettori.appendChild(riga);
    righeSettore[idGruppo] = { elemento: riga, valoreEl: valore };
});

// ingrandisce/rimpicciolisce il modello trascinando lo slider Grandezza
const sliderGrandezza = document.getElementById('grandezza');
const grandezzaValore = document.getElementById('grandezza-valore');

sliderGrandezza.addEventListener('input', function() {
    const scala = sliderGrandezza.value / 100;
    if (modelloOcchiali) {
        const nuovaScala = scala * scalaBase;
        modelloOcchiali.scale.setScalar(nuovaScala);
        modelloOcchiali.position.set(-centroModello.x * nuovaScala, -centroModello.y * nuovaScala, -centroModello.z * nuovaScala);
    }
    grandezzaValore.textContent = sliderGrandezza.value + '%';
});

// "Illuminata": accende la luce in alto a destra puntata sull'oggetto. "Opaca": la spegne.
// Non cambia mai i materiali, non c'è trasparenza legata a questo bottone.
let modalitaIlluminata = true;
const bottoneModalita = document.getElementById('toggle-modalita');

bottoneModalita.addEventListener('click', function() {
    modalitaIlluminata = !modalitaIlluminata;
    luceDirezionale.visible = modalitaIlluminata;
    bottoneModalita.textContent = modalitaIlluminata ? 'Illuminata' : 'Opaca';
});

// "Vista esplosa" / "Vista assemblata": alterna tra le due modalità, con una transizione animata
// (non uno scatto secco) tra la posizione assemblata e quella con i pezzi allontanati dal centro.
const bottoneEsploso = document.getElementById('toggle-esploso');

bottoneEsploso.addEventListener('click', function() {
    vistaEsplosa = !vistaEsplosa;
    transizioneEsplosioneInizio = performance.now();
    transizioneEsplosioneDa = ampiezzaEsplosione;
    transizioneEsplosioneA = vistaEsplosa ? 1 : 0;
    bottoneEsploso.textContent = vistaEsplosa ? 'Vista assemblata' : 'Vista esplosa';
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
