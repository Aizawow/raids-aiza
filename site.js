'use strict';
// Site des raids : données écrites par le pont (data/*.json). Chaque raider a son profil : ses hauts faits, son bestiaire.
// Navigation par l'adresse : #vue=profil&joueur=bob&onglet=hf&cat=donjons (le lien d'un profil se partage tel quel).
const $ = (id) => document.getElementById(id);
const D = {};
const RANGS = { commun: ['Commun', '#ffffff'], inhabituel: ['Inhabituel', '#1eff00'], rare: ['Rare', '#3a9cff'],
  epique: ['Épique', '#b56cf5'], legendaire: ['Légendaire', '#ff8000'] };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nb = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const date = (s) => { const d = new Date(s); return s && !isNaN(d) ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''; };
const classeImg = (c) => `assets/classes/${String(c || '').normalize('NFD').replace(/[̀-ͯ]/g, '')}.png`;
const pluriel = (n, mot) => `${nb(n)} ${mot}${n > 1 ? 's' : ''}`;
const ORDRE_RANGS = ['legendaire', 'epique', 'rare', 'inhabituel', 'commun'];

/* ---------------------------------------------------------------- navigation */
const etat = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const lien = (p) => '#' + new URLSearchParams(Object.entries({ ...etat(), ...p }).filter(([, v]) => v != null && v !== '')).toString();
const lienProfil = (j, p = {}) => '#' + new URLSearchParams({ vue: 'profil', joueur: j.login, ...p }).toString();
const trouver = (texte) => {
  const v = String(texte || '').trim().toLowerCase();
  return v ? D.joueurs.find((x) => x.nom.toLowerCase() === v || (x.login || '').toLowerCase() === v) : null;
};

async function charger() {
  const lire = async (n) => (await fetch(`data/${n}.json?v=${Date.now() >> 16}`)).json();
  [D.joueurs, D.bestiaire, D.hf, D.raids, D.regles, D.meta] = await Promise.all(
    ['joueurs', 'bestiaire', 'hauts_faits', 'raids', 'regles', 'meta'].map(lire));
  D.parHf = Object.fromEntries(D.hf.liste.map((h) => [h.id, h]));
  D.parCr = Object.fromEntries(D.bestiaire.map((c) => [c.id, c]));
  document.title = D.meta.titre;
  $('titre').textContent = D.meta.titre;
  $('liste-joueurs').innerHTML = D.joueurs.map((j) => `<option value="${esc(j.nom)}">`).join('');
  $('pied').textContent = `Mis à jour le ${new Date(D.meta.maj).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`;
  afficher();
}
// recherche : le pseudo doit exister (un raider apparaît après son premier raid)
const chercher = (texte, ou) => {
  const j = trouver(texte);
  if (j) { location.hash = lienProfil(j); return true; }
  if (ou) ou.textContent = texte.trim() ? `Aucun raider « ${texte.trim()} » : il faut avoir participé à un raid pour avoir un profil.` : '';
  return false;
};
$('recherche').onsubmit = (e) => {
  e.preventDefault();
  if (chercher($('recherche-joueur').value, null)) { $('recherche-joueur').value = ''; $('recherche-joueur').blur(); }
  else location.hash = '#' + new URLSearchParams({ vue: 'profil', joueur: $('recherche-joueur').value.trim() }).toString();
};
addEventListener('hashchange', afficher);

function afficher() {
  const e = etat(), vue = e.vue || 'profil';
  document.querySelectorAll('#onglets a').forEach((a) => a.classList.toggle('actif', a.dataset.vue === vue));
  const vues = { profil: vueProfil, classements: vueClassements, bestiaire: vueBestiaire, raids: vueRaids, regles: vueRegles };
  $('vue').innerHTML = (vues[vue] || vueProfil)(e);
  if (vue === 'profil') brancherProfil(e);
  if (vue === 'bestiaire') brancherBestiaire(null);
  scrollTo({ top: 0 });
}

/* ---------------------------------------------------------------- accueil : retrouver son profil */
function vueAccueil(inconnu) {
  return `<section class="accueil surface">
      <i class="blason"></i>
      <h1>Ton profil de raider</h1>
      <p>Chaque raider a ses propres hauts faits, sa progression et son bestiaire. Entre ton pseudo Twitch pour les retrouver.</p>
      <form id="accueil-form" class="accueil-recherche" autocomplete="off">
        <input id="accueil-pseudo" list="liste-joueurs" placeholder="Ton pseudo Twitch" aria-label="Ton pseudo Twitch" value="${esc(inconnu || '')}">
        <button>Voir le profil</button>
      </form>
      <p class="erreur" id="accueil-erreur">${inconnu ? `Aucun raider « ${esc(inconnu)} » : il faut avoir participé à un raid pour avoir un profil.` : ''}</p>
      <div class="liens"><a href="#vue=classements">Classements</a><a href="#vue=bestiaire">Bestiaire</a><a href="#vue=regles">Comment jouer</a></div>
    </section>`;
}

/* ---------------------------------------------------------------- profil */
function vueProfil(e) {
  const j = trouver(e.joueur);
  if (!j) return vueAccueil(e.joueur);
  const s = j.stats || {}, onglet = e.onglet === 'bestiaire' ? 'bestiaire' : 'hf';
  const classe = j.classe.charAt(0).toUpperCase() + j.classe.slice(1);
  const tete = `<div class="surface profil" style="--classe:${j.couleur}"><img class="avatar" src="${classeImg(j.classe)}" alt="">
      <div><div class="nom">${esc(j.nom)}</div><div class="sous">${esc(classe)}${j.classe_choisie ? '' : ' · classe tirée au hasard (!class pour choisir)'}</div></div>
      <div class="points"><div><small>Points de hauts faits</small><b>${nb(j.points)}</b></div><i></i></div></div>
    <div class="stats-rapides"><div><b>${nb(s.victoires)}</b><span>Victoires</span></div><div><b>${nb(Object.keys(j.tues).length)}</b><span>Ennemis vaincus</span></div>
      <div><b>${nb(s.degats)}</b><span>Dégâts infligés</span></div><div><b>${nb(s.points)}</b><span>Points dépensés</span></div></div>
    <nav class="sous-onglets"><a href="${lienProfil(j)}" class="${onglet === 'hf' ? 'actif' : ''}">Hauts faits</a>
      <a href="${lienProfil(j, { onglet: 'bestiaire' })}" class="${onglet === 'bestiaire' ? 'actif' : ''}">Bestiaire</a></nav>`;
  return tete + (onglet === 'bestiaire' ? vueBestiaire({}, j) : hautsFaits(j, e.cat || ''));
}
function brancherProfil(e) {
  const j = trouver(e.joueur);
  if (!j) {
    $('accueil-form').onsubmit = (ev) => { ev.preventDefault(); chercher($('accueil-pseudo').value, $('accueil-erreur')); };
    $('accueil-pseudo').focus();
    return;
  }
  if (e.onglet === 'bestiaire') brancherBestiaire(j);
  const ouvrables = () => document.querySelectorAll('.hf.ouvrable .hf-tete').forEach((t) => { t.onclick = () => t.parentElement.classList.toggle('ouvert'); });
  ouvrables();
  const champ = $('recherche-hf'), boite = $('hf-contenu');
  if (champ && boite) {
    const origine = boite.innerHTML;
    champ.oninput = () => { boite.innerHTML = rechercheHf(j, champ.value) ?? origine; ouvrables(); };
  }
}

/* ---------------------------------------------------------------- hauts faits d'un raider */
function avancement(h, j) {
  const tues = j.tues, stats = j.stats || {}, obt = j.hauts_faits;
  return h.criteres.map((k) => {
    if (k.t === 'tuer') return { ...k, fait: k.cr in tues, date: tues[k.cr] };
    if (k.t === 'stat') { const v = +(stats[k.stat] || 0); return { ...k, valeur: v, fait: v >= k.seuil }; }
    if (k.t === 'compte') {
      const v = Object.keys(tues).filter((cid) => { const c = D.parCr[cid]; return c && Object.entries(k.filtre).every(([a, b]) => (c[a] ?? false) === b); }).length;
      return { ...k, valeur: v, fait: v >= k.seuil };
    }
    if (k.t === 'zones') { const v = new Set(Object.keys(tues).map((cid) => D.parCr[cid] && D.parCr[cid].zone).filter(Boolean)).size; return { ...k, valeur: v, fait: v >= k.seuil }; }
    if (k.t === 'haut_fait') return { ...k, fait: !!obt[k.id] };
    return { ...k, fait: false };
  });
}
const barre = (fait, total, gauche = '', classe = '') =>
  `<div class="barre ${classe}" style="--p:${(100 * Math.min(fait, total) / Math.max(1, total)).toFixed(1)}%"><i></i>`
  + `<span>${gauche ? `<em>${gauche}</em>` : ''}<em>${nb(Math.min(fait, total))} / ${nb(total)}</em></span></div>`;

function ligneHf(h, j) {
  const obtenu = j.hauts_faits[h.id];
  const secret = h.cache && !obtenu;
  const crits = secret ? [] : avancement(h, j);
  let details = '';
  if (crits.length === 1 && crits[0].seuil) details = barre(crits[0].valeur, crits[0].seuil, '', 'seule');
  else if (crits.length) {
    const liste = crits.map((k) => {
      if (k.t === 'haut_fait') {
        const s = D.parHf[k.id] || {};
        return `<div class="crit${k.fait ? ' fait' : ''}"><i class="coche"></i><img src="assets/hf/${s.icone}.png" alt=""><span>${esc(s.nom || k.id)}</span></div>`;
      }
      return `<div class="crit${k.fait ? ' fait' : ''}"${k.date ? ` title="Vaincu le ${date(k.date)}"` : ''}><i class="coche"></i><span>${esc(k.nom || k.cr)}</span></div>`;
    }).join('');
    details = barre(crits.filter((k) => k.fait).length, crits.length, '', 'seule') + `<div class="liste-crit">${liste}</div>`;
  }
  return `<article class="hf ${obtenu ? 'obtenu' : 'non'}${details ? ' ouvrable' : ''}">
    <div class="hf-tete">
      <div class="hf-icone"><img src="assets/hf/${secret ? 'general' : h.icone}.png" alt="" loading="lazy"><i></i></div>
      <div class="hf-texte"><h3>${secret ? 'Haut fait caché' : esc(h.nom)}</h3><p>${secret ? 'À découvrir pendant les raids…' : esc(h.description)}</p></div>
      <div class="hf-droite"><div class="hf-bouclier"><span>${h.points}</span></div>${obtenu ? `<span class="hf-date">${date(obtenu)}</span>` : ''}</div>
      ${details ? '<i class="hf-chevron"></i>' : ''}
    </div>
    ${details ? `<div class="hf-details"><div><div class="interieur">${details}</div></div></div>` : ''}
  </article>`;
}
/* recherche : un haut fait par son nom ou sa description, ou une créature par son nom ; une créature fait remonter les
   hauts faits qui la demandent, ceux de son type ou de son rang, et ceux qui regroupent les précédents */
const sansAccent = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RANGS_NOM = { commun: 'Commun', inhabituel: 'Inhabituel', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
function rechercheHf(j, texte) {
  const t = sansAccent(texte.trim());
  if (t.length < 2) return null;
  const visibles = D.hf.liste.filter((h) => !h.cache || j.hauts_faits[h.id]);
  const creatures = (D.hf.index || []).filter((c) => sansAccent(c.nom).includes(t));
  const trouves = new Set(visibles.filter((h) => sansAccent(h.nom).includes(t) || sansAccent(h.description).includes(t)).map((h) => h.id));
  const lie = (h, c) => h.criteres.some((k) => (k.t === 'tuer' && k.cr === c.id)
    || (k.t === 'compte' && Object.entries(k.filtre).every(([a, b]) => (c[a] ?? false) === b)));
  for (const c of creatures) visibles.filter((h) => lie(h, c)).forEach((h) => trouves.add(h.id));
  visibles.filter((h) => h.criteres.some((k) => k.t === 'haut_fait' && trouves.has(k.id))).forEach((h) => trouves.add(h.id));
  const liste = visibles.filter((h) => trouves.has(h.id)).sort((a, b) => !!j.hauts_faits[b.id] - !!j.hauts_faits[a.id]);
  const puces = creatures.slice(0, 8).map((c) => `<span class="puce"><b>${esc(c.nom)}</b>${[RANGS_NOM[c.rang], c.type,
    ...(c.familles || []), c.lieu].filter(Boolean).map(esc).join(' · ')}</span>`).join('');
  return `<h2 class="section">${liste.length} haut${liste.length > 1 ? 's' : ''} fait${liste.length > 1 ? 's' : ''} pour « ${esc(texte.trim())} »</h2>`
    + (puces ? `<div class="puces">${puces}${creatures.length > 8 ? `<span class="puce">+ ${creatures.length - 8} autres</span>` : ''}</div>` : '')
    + (liste.length ? liste.map((h) => ligneHf(h, j)).join('') : '<p class="vide">Aucun haut fait ne correspond.</p>');
}
function hautsFaits(j, cat) {
  const parCat = Object.fromEntries(D.hf.categories.map(([c]) => [c, D.hf.liste.filter((h) => h.categorie === c)]));
  const fait = (h) => !!j.hauts_faits[h.id];
  const menu = [['', 'Résumé'], ...D.hf.categories].map(([c, nom]) => {
    const l = c ? parCat[c] : D.hf.liste, f = l.filter(fait).length;
    return `<a href="${lienProfil(j, c ? { cat: c } : {})}" class="${c === cat ? 'actif' : ''}"><div class="ligne-cat">${nom}<small>${f}/${l.length}</small></div>`
      + `<div class="mini"><i style="width:${(100 * f / Math.max(1, l.length)).toFixed(1)}%"></i></div></a>`;
  }).join('');
  let contenu;
  if (!cat) {
    const recents = Object.entries(j.hauts_faits).filter(([id]) => D.parHf[id]).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 5).map(([id]) => D.parHf[id]);
    const barres = [['', 'Hauts faits obtenus', D.hf.liste], ...D.hf.categories.map(([c, n]) => [c, n, parCat[c]])].map(([c, nom, l], i) =>
      `<a class="${i ? '' : 'total'}" href="${lienProfil(j, c ? { cat: c } : {})}">${barre(l.filter(fait).length, l.length, nom, 'grande')}</a>`).join('');
    contenu = `<h2 class="section">Hauts faits récents</h2>
      ${recents.length ? recents.map((h) => ligneHf(h, j)).join('') : '<p class="vide">Pas encore de haut fait : ils tombent à la fin des raids.</p>'}
      <h2 class="section">Progression</h2><div class="progressions">${barres}</div>`;
  } else {
    const l = [...(parCat[cat] || [])].sort((a, b) => fait(b) - fait(a) || (j.hauts_faits[b.id] || '').localeCompare(j.hauts_faits[a.id] || ''));
    contenu = `<h2 class="section">${(D.hf.categories.find(([c]) => c === cat) || [, ''])[1]}</h2>` + l.map((h) => ligneHf(h, j)).join('');
  }
  return `<div class="hf-page"><nav class="surface categories">${menu}</nav><div>
    <div class="recherche recherche-hf"><input id="recherche-hf" type="search" autocomplete="off"
      placeholder="Rechercher un haut fait ou une créature (ex. : loup, Aku'mai, Mortemines)" aria-label="Rechercher un haut fait"></div>
    <div id="hf-contenu">${contenu}</div></div></div>`;
}

/* ---------------------------------------------------------------- classements */
const CLASSEMENTS = [['hf', 'Hauts faits', (j) => j.points, 'points'], ['degats', 'Dégâts', (j) => j.stats.degats, 'dégâts'],
  ['victoires', 'Victoires', (j) => j.stats.victoires, 'victoires'], ['ennemis', 'Ennemis vaincus', (j) => Object.keys(j.tues).length, 'ennemis'],
  ['coups_fatals', 'Coups de grâce', (j) => j.stats.coups_fatals, 'coups de grâce'], ['premier_dps', 'Premier au DPS', (j) => j.stats.premier_dps, 'fois'],
  ['interruptions', 'Interruptions', (j) => j.stats.interruptions, 'interruptions'], ['dissipations', 'Dissipations', (j) => j.stats.dissipations, 'dissipations'],
  ['furies', 'BL', (j) => j.stats.furies, 'BL'], ['points', 'Points dépensés', (j) => j.stats.points, 'points']];
function vueClassements(e) {
  const [cle, nom, f, unite] = CLASSEMENTS.find(([c]) => c === e.classement) || CLASSEMENTS[0];
  const l = D.joueurs.map((j) => [j, +f(j) || 0]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 100);
  const nomJ = (j) => `<a class="joueur" href="${lienProfil(j)}"><img src="${classeImg(j.classe)}" alt=""><span style="color:${j.couleur}">${esc(j.nom)}</span></a>`;
  const podium = l.slice(0, 3).map(([j, v], i) => `<a class="surface p${i + 1}" href="${lienProfil(j)}">
      <div class="medaille">${i + 1}</div><img src="${classeImg(j.classe)}" alt=""><div class="nom" style="color:${j.couleur}">${esc(j.nom)}</div><div class="val">${nb(v)} ${unite}</div></a>`).join('');
  return `<div class="titre-page"><h1>Classements</h1><p>${nom}</p></div>
    <div class="pilules">${CLASSEMENTS.map(([c, n]) => `<a href="${lien({ classement: c })}" class="${c === cle ? 'actif' : ''}">${n}</a>`).join('')}</div>
    ${l.length ? `<div class="podium">${podium}</div>` : ''}
    <div class="surface table"><table class="tab"><thead><tr><th>#</th><th>Raider</th><th class="n">${nom}</th></tr></thead><tbody>
    ${l.map(([j, v], i) => `<tr><td class="rang">${i + 1}</td><td>${nomJ(j)}</td><td class="n">${nb(v)}</td></tr>`).join('')
      || '<tr><td colspan="3" class="vide">Pas encore de raider classé.</td></tr>'}</tbody></table></div>`;
}

/* ---------------------------------------------------------------- bestiaire (général, ou celui d'un raider dans son profil) */
function vueBestiaire(e, j) {
  const connus = D.bestiaire.filter((c) => c.decouvert);
  const vals = (k) => [...new Set(connus.flatMap((c) => [].concat(c[k] || [])))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const opt = (id, titre, l) => `<select id="${id}"><option value="">${titre}</option>${l.map((x) => `<option>${esc(x)}</option>`).join('')}</select>`;
  const etatPerso = j ? `<select id="f-etat"><option value="">Tous</option><option value="v">Vaincus</option><option value="r">Rencontrés, pas vaincus</option><option value="n">Jamais rencontrés</option></select>` : '';
  const titre = j ? '' : `<div class="titre-page"><h1>Bestiaire</h1><p>${connus.length} ennemis découverts sur ${D.bestiaire.length} · les autres se dévoilent en apparaissant pendant un raid</p></div>`;
  return `${titre}<div class="surface filtres"><input id="f-texte" placeholder="Rechercher un ennemi">
      <select id="f-rang"><option value="">Tous les rangs</option>${ORDRE_RANGS.map((k) => `<option value="${k}">${RANGS[k][0]}</option>`).join('')}</select>
      ${opt('f-type', 'Tous les types', vals('type'))}${opt('f-famille', 'Toutes les familles', vals('familles'))}${opt('f-lieu', 'Tous les lieux', vals('lieu'))}
      ${etatPerso}<span class="compte" id="f-compte"></span></div>
    <div class="grille" id="grille"></div>`;
}
function brancherBestiaire(j) {
  const dessiner = () => {
    const t = $('f-texte').value.toLowerCase(), r = $('f-rang').value, ty = $('f-type').value, fa = $('f-famille').value, li = $('f-lieu').value;
    const et = $('f-etat') ? $('f-etat').value : '';
    const statut = (c) => (j && j.tues[c.id] ? 'v' : j && j.vus[c.id] ? 'r' : 'n');
    const filtre = t || ty || fa || li;
    const l = D.bestiaire.filter((c) => (!r || c.rang === r) && (!filtre || (c.decouvert && (!t || c.nom.toLowerCase().includes(t))
      && (!ty || c.type === ty) && (!fa || (c.familles || []).includes(fa)) && (!li || c.lieu === li))) && (!et || statut(c) === et))
      .sort((a, b) => (b.decouvert ? 1 : 0) - (a.decouvert ? 1 : 0) || ORDRE_RANGS.indexOf(a.rang) - ORDRE_RANGS.indexOf(b.rang) || (a.nom || '').localeCompare(b.nom || ''));
    $('f-compte').textContent = pluriel(l.length, 'ennemi');
    $('grille').innerHTML = l.map((c) => {
      const [rang, coul] = RANGS[c.rang] || ['', '#fff'];
      if (!c.decouvert) {
        return `<div class="surface ennemi inconnu" style="--r:${coul}"><div class="portrait"><span class="point">?</span><span class="badge">${esc(rang)}</span></div>
          <div class="corps"><div class="nom">???</div><div class="lieu">Pas encore apparu en raid</div></div></div>`;
      }
      const tags = [c.type, ...(c.familles || []), c.race, c.faction].filter(Boolean);
      let perso = '';
      if (j) {
        const s = statut(c);
        perso = s === 'v' ? `<span class="etat v">Vaincu le ${date(j.tues[c.id])}</span>` : s === 'r' ? `<span class="etat r">Rencontré le ${date(j.vus[c.id])}</span>` : '<span class="etat n">Jamais rencontré</span>';
      }
      return `<div class="surface ennemi${j && statut(c) === 'n' ? ' terne' : ''}" style="--r:${coul}">
        <div class="portrait">${c.image ? `<img src="${c.image}" alt="" loading="lazy">` : '<span class="point">?</span>'}<span class="badge">${esc(rang)}</span></div>
        <div class="corps"><div class="nom">${esc(c.nom)}</div><div class="lieu">${esc(c.lieu)}${c.niveau ? ` · niveau ${c.niveau}` : ''}</div>
          <div class="tags">${tags.map((x) => `<span>${esc(x)}</span>`).join('')}</div>${perso ? `<div class="bas">${perso}</div>` : ''}</div></div>`;
    }).join('') || '<p class="vide">Aucun ennemi ne correspond.</p>';
  };
  ['f-texte', 'f-rang', 'f-type', 'f-famille', 'f-lieu', 'f-etat'].forEach((id) => { if ($(id)) $(id).oninput = dessiner; });
  dessiner();
}

/* ---------------------------------------------------------------- derniers raids */
function vueRaids() {
  const nomJ = (n) => { const j = trouver(n); return j ? `<a href="${lienProfil(j)}" style="color:${j.couleur}">${esc(n)}</a>` : esc(n || '—'); };
  return `<div class="titre-page"><h1>Derniers raids</h1><p>Les ${D.raids.length} derniers combats</p></div>
    <div class="surface table"><table class="tab"><thead><tr><th>Date</th><th>Ennemi</th><th>Résultat</th><th class="n">Raiders</th><th>Premier au DPS</th><th>Coup de grâce</th></tr></thead><tbody>
    ${D.raids.map((r) => `<tr><td>${date(r.date)}</td><td style="color:${(RANGS[r.rang] || [, '#fff'])[1]}">${esc(r.creature)}</td>
      <td><span class="resultat ${r.statut === 'vaincu' ? 'v' : 'e'}">${r.statut === 'vaincu' ? 'Vaincu' : 'Enfui'}</span></td><td class="n">${r.raiders}</td>
      <td>${nomJ(r.top)}</td><td>${nomJ(r.coup_fatal)}</td></tr>`).join('')
      || '<tr><td colspan="6" class="vide">Pas encore de raid.</td></tr>'}</tbody></table></div>`;
}

/* ---------------------------------------------------------------- règles */
function vueRegles() {
  const R = D.regles, [a, b] = R.intervalle_min || [30, 60];
  const total = R.rangs.reduce((s, r) => s + r.proba, 0) || 1, S = R.soins || {}, B = R.bulle || {};
  return `<div class="titre-page"><h1>Règles</h1><p>Comment fonctionnent les raids de la chaîne</p></div>
    <div class="regles"><div>
      <section class="surface bloc"><h2>Comment ça marche</h2>
        <p>Pendant le live, un ennemi de World of Warcraft: Forever surgit toutes les ${a} à ${b} minutes. Une roulette tire son rang, puis il apparaît : le raid a quelques minutes pour l'abattre avant qu'il ne s'enfuie. Ses points de vie dépendent du nombre de viewers présents${R.niveaux ? ` et de son niveau : un ennemi de niveau ${R.niveaux.reference} a les points de vie de son rang, un ennemi de bas niveau jusqu'à ${Math.round(100 * (1 - R.niveaux.min))} % de moins, un ennemi de niveau 60 environ ${Math.round(100 * (Math.min(R.niveaux.max, (60 / R.niveaux.reference) ** R.niveaux.exposant) - 1))} % de plus${R.niveaux.legendaires ? '' : ' (les légendaires gardent les points de vie de leur rang)'}` : ''}.</p>
        <p>On l'attaque avec ses <b>points de chaîne</b> : ouvre le menu des points sous le chat de Twitch, les attaques n'y apparaissent que pendant un raid. Une attaque lancée quand aucun raid n'est en cours, ou impossible à ce moment-là, est <b>remboursée</b>.</p></section>
      <section class="surface bloc"><h2>Attaques</h2><div class="attaques">${R.attaques.map((x) => `<div class="attaque"><img src="assets/icones/${x.id}.png" alt="">
        <div><div class="t"><b>${esc(x.titre)}</b><small>${nb(x.cout)} pts</small></div><p>${esc(x.description)}</p></div></div>`).join('')}</div></section>
      <section class="surface bloc"><h2>Sorts des ennemis</h2>
        <div class="sorts-boss">
          <div class="sort-boss"><img src="assets/icones/soin.png" alt=""><div><b>${esc(S.titre || 'Soins')}</b>
            <p>${S.incantation_s || 10} s d'incantation, puis l'ennemi récupère ${S.soin_pct || 15} % de ses PV (seulement s'il est sous ${S.sous_pct || 90} %). Un <b>Coup de pied</b> pendant l'incantation coupe le sort.</p></div></div>
          <div class="sort-boss"><img src="assets/icones/bulle.png" alt=""><div><b>${esc(B.titre || 'Bulle des arcanes')}</b>
            <p>Instantanée : impossible à couper. L'ennemi devient insensible à tous les dégâts jusqu'à ce qu'un raider lance <b>Dissipation de la magie</b>.</p></div></div>
        </div>
        <ul>
          <li><b>Qui lance quoi</b> : les ennemis communs et inhabituels n'ont aucun sort ; certains rares se soignent ; les épiques et les légendaires posent leur bulle, puis se soignent à l'abri. Les légendaires relancent leurs Soins ${S.intervalle_legendaire_s || 20} s plus tard.</li>
          <li><b>Attaque dans la bulle</b> : elle est absorbée. Ses points sont dépensés et ne sont pas remboursés, et ses dégâts ne comptent pas.</li>
          <li><b>Soins à l'abri de la bulle</b> : Coup de pied est impossible (et remboursé) tant que la bulle tient : il faut d'abord la dissiper.</li>
          <li>Chaque sort est annoncé dans le chat et par l'alerte de raid.</li>
        </ul></section>
    </div><aside>
      <section class="surface bloc"><h2>Rangs</h2><div class="rangs">${R.rangs.map((r) => `<div><span style="color:${(RANGS[r.id] || [, r.couleur])[1]}">${esc(r.nom)}</span><small>${Math.round(100 * r.proba / total)} % · ${Math.round(r.duree_s / 60)} min</small></div>`).join('')}</div></section>
      ${R.paris && R.paris.actif ? `<section class="surface bloc"><h2>Paris</h2><p>À la fin de chaque raid, une <b>prédiction</b> Twitch est lancée sur le raid suivant : mise tes points de chaîne au-dessus du chat pendant ${R.paris.fenetre_min} min. Les gagnants se partagent les points des perdants.</p>
        <ul>${R.paris.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
        <p>Si le live s'arrête avant le raid suivant, tout le monde est remboursé.</p></section>` : ''}
      <section class="surface bloc"><h2>Ta classe</h2><p>Tape <b>!class</b> suivi de ta classe dans le chat (guerrier, paladin, chasseur, voleur, prêtre, chaman, mage, démoniste, druide) pour ta couleur et ton icône.</p></section>
      <section class="surface bloc"><h2>Hauts faits</h2><p>Chacun vaut ${D.hf.points} points : donjons complétés, familles de monstres, rares des zones, exploits de combat, points dépensés… Certains sont cachés. Ils tombent à la fin de chaque raid et se consultent dans ton profil.</p></section>
    </aside></div>`;
}

charger().catch((err) => { $('vue').innerHTML = `<p class="vide">Données indisponibles (${esc(err.message)}).</p>`; });
