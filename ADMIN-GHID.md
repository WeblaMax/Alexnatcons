# Ghid — administrare poze (ALEXNATCONS)

Adminul adaugă, șterge și ordonează pozele din pagina **`admin.html`**, direct din browser (calculator sau telefon).
Site-ul se actualizează singur în **1–2 minute** după „Publică”.

## 1. Creezi tokenul GitHub (o singură dată, ~5 minute)

Tokenul e ca o parolă specială, valabilă doar pentru acest site.

1. Intră pe github.com cu contul care are acces la repo-ul **Alexnatcons** (proprietar sau colaborator cu drept de scriere).
2. Sus-dreapta: poza de profil → **Settings** → jos în stânga **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Completează:
   - **Token name:** `Admin poze ALEXNATCONS`
   - **Expiration:** cel mai lung termen permis (de obicei 1 an; îți notezi data, ca să-l reînnoiești)
   - **Resource owner:** contul care deține repo-ul (WeblaMax)
   - **Repository access:** *Only select repositories* → alege **Alexnatcons**
   - **Permissions → Repository permissions → Contents:** **Read and write** (restul rămân neatinse)
4. **Generate token** și **copiază imediat** textul care începe cu `github_pat_…`. Nu îl mai poți vedea după ce închizi pagina.

> Nu da tokenul nimănui și nu-l trimite pe chat. Cine îl are poate schimba site-ul. Dacă l-ai pierdut sau ai dubii, îl ștergi din aceeași pagină GitHub și creezi altul.

## 2. Folosești panoul

1. Deschide `https://<adresa-site-ului>/admin.html`. Pagina nu apare în meniu și Google nu o indexează.
2. Lipește tokenul → **Conectează**. Browserul îl ține minte, deci data viitoare intri direct.
3. Alege **subcategoria** (Construcții civile, Apă și canalizare, Demolări, Lucrări de teren, Utilaje de Construcții, Dispozitive pentru vulcanizare).
4. **Trage pozele** în chenar sau apasă pe el și alege-le din telefon/calculator. Poți alege mai multe odată.
5. Scrie sub fiecare poză nouă o **descriere scurtă** (ex. „Demolare casă veche, Ungheni”). Dacă o lași goală, site-ul pune un text generic.
6. Poți **muta** pozele cu ↑ ↓ (prima apare prima în cardul de pe pagina de start) sau **șterge** pozele vechi.
7. Apasă **Publică modificările**. Când apare „Gata!”, așteaptă 1–2 minute și reîncarcă site-ul cu `Ctrl+Shift+R`.

Pozele se micșorează automat în browser (max. 1600 px) și se comprimă, deci pot fi alese direct din telefon, chiar de 5–8 MB fiecare.

## 3. Probleme frecvente

| Mesaj | Ce faci |
|---|---|
| „Token invalid sau expirat” | Creezi alt token (pasul 1) și îl lipești din nou. |
| „Tokenul nu vede repo-ul…” | Ai ales alt repo sau alt cont la „Repository access”. Refă tokenul. |
| „Tokenul nu are voie să scrie” | La permisiuni, **Contents** trebuie pe **Read and write**. |
| „Site-ul s-a schimbat între timp” | Reîncarcă `admin.html` și repetă. |
| Pozele nu apar pe site | Așteaptă 2 minute, apoi `Ctrl+Shift+R`. Verifică în GitHub → Actions dacă „pages build and deployment” e verde. |

## 4. Pentru cine întreține codul

- Pozele și listele lor sunt în **`galerie.json`**. Fiecare poză are `src` (mare), `thumb` (miniatură), `card` (slideshow), `alt`, `w`, `h`.
- Pozele încărcate stau în `assets/lucrari/<categorie>/`.
- Repo-ul și ramura sunt în `admin.js` (constanta `REPO`). Categoriile sunt în `CATS`.
- Pentru o categorie nouă: adaug-o în `CATS` (admin.js), pune `data-gallery="<cheie>"` pe pagina ei și o cheie nouă în `galerie.json`.
