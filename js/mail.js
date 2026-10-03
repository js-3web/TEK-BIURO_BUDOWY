/* =========================================================
   BIURO BUDOWY — powiadomienia e-mail
   ---------------------------------------------------------
   Prototyp HTML nie ma serwera, więc NIE wysyła maili sam.
   Przygotowuje gotową wiadomość na 2 sposoby:
   • „Otwórz w poczcie” (mailto:) – otwiera Outlook/Thunderbird z tematem i treścią (bez załączników),
   • „Pobierz .eml ze zdjęciami” – plik wiadomości ze zdjęciami i wycinkiem rzutu;
     Outlook otwiera go jako wiadomość do wysłania (nagłówek X-Unsent).
   Wysyłka w pełni automatyczna = etap serwerowy (np. Microsoft 365 / SMTP firmy).
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const ML = M.ML = {};
  const b64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const wrap = (s) => s.replace(/.{1,76}/g, '$&\r\n');
  const encHeader = (s) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;

  ML.issueText = (list, company) => {
    const p = M.S.project || {}; const sig = M.S.settings.mailSignature || '';
    const one = list.length === 1;
    const subject = one ? `[${p.short || p.name}] Uwaga ${list[0].nr} – ${list[0].cat || ''} – termin ${M.fmt(list[0].due) || 'wg ustaleń'}` : `[${p.short || p.name}] Zestawienie uwag do usunięcia (${list.length}) – ${company ? company.name : ''}`;
    const lines = list.map(i => { const pl = M.S.get('plans', i.planId); return `${i.nr} | ${i.cat || ''} | ${pl ? pl.name : 'bez rzutu'}\n   ${i.desc || ''}\n   Termin: ${M.fmt(i.due) || 'wg ustaleń'} | Status: ${(M.UI.ISSUE_ST[i.status] || ['—'])[0]}`; });
    const body = `Dzień dobry,\n\n${one ? 'na budowie zgłoszono uwagę przypisaną do Państwa firmy:' : 'przesyłamy zestawienie otwartych uwag przypisanych do Państwa firmy:'}\n\nBudowa: ${p.name || ''}\n\n${lines.join('\n\n')}\n\nProsimy o usunięcie nieprawidłowości w terminie i potwierdzenie mailowo (ze zdjęciem po naprawie).\n\n${sig}`;
    return { subject, body, to: company && company.email ? company.email : '' };
  };
  ML.mailto = ({ to, subject, body, cc }) => {
    let b = body; if (b.length > 1700) b = b.slice(0, 1700) + '\n[…treść skrócona – pełne zestawienie w załączniku PDF]';
    const q = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(b)}`]; if (cc) q.push(`cc=${encodeURIComponent(cc)}`);
    const a = document.createElement('a'); a.href = `mailto:${encodeURIComponent(to || '')}?${q.join('&')}`; a.click();
  };
  /** plik .eml (MIME) z załącznikami: [{name, blob}] */
  ML.eml = async ({ to, subject, body, attachments = [] }) => {
    const bd = 'bb_' + M.uid();
    let s = `X-Unsent: 1\r\nTo: ${to || ''}\r\nSubject: ${encHeader(subject)}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${bd}"\r\n\r\n`;
    s += `--${bd}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(b64(body))}\r\n`;
    for (const at of attachments) {
      const du = await M.blobToDataURL(at.blob); const data = du.split(',')[1];
      s += `--${bd}\r\nContent-Type: ${at.blob.type || 'application/octet-stream'}; name="${encHeader(at.name)}"\r\nContent-Disposition: attachment; filename="${encHeader(at.name)}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(data)}\r\n`;
    }
    s += `--${bd}--\r\n`;
    return new Blob([s], { type: 'message/rfc822' });
  };
  ML.issueAttachments = async (list) => {
    const out = [];
    for (const i of list) {
      const crop = await M.PR.locationCrop(i); if (crop) out.push({ name: `${i.nr}_lokalizacja.jpg`, blob: M.dataURLToBlob(crop) });
      let n = 0; for (const p of (i.photos || [])) { const b = await M.S.getBlob(p.blobId); if (b) out.push({ name: `${i.nr}_zdjecie_${++n}.jpg`, blob: b }); }
    }
    return out;
  };
  /** okno „powiadom odpowiedzialnego” – po zapisaniu uwagi lub z raportu */
  ML.notify = (list, companyId, { auto = false } = {}) => {
    const c = M.S.company(companyId); const msg = ML.issueText(list, c);
    const m = M.UI.modal({
      title: `${auto ? 'Powiadom odpowiedzialnego' : 'Wiadomość do firmy'} – ${e(c ? c.name : '')}`,
      body: `${!c || !c.email ? `<div class="banner warn">${M.icon.alert}<span>Firma nie ma adresu e-mail. Uzupełnij go w Ustawieniach → Firmy.</span></div>` : ''}
        <label class="f">Do<input type="email" id="mTo" value="${e(msg.to)}"></label>
        <label class="f">Temat<input type="text" id="mSub" value="${e(msg.subject)}"></label>
        <label class="f">Treść<textarea id="mBody" style="min-height:220px">${e(msg.body)}</textarea></label>
        <div class="banner info">${M.icon.mail}<span class="small">Prototyp nie wysyła poczty sam. „Otwórz w poczcie” – szybko, bez załączników. „.eml ze zdjęciami” – Outlook otworzy gotową wiadomość ze zdjęciami i wycinkiem rzutu do wysłania. Automatyczna wysyłka – w wersji serwerowej.</span></div>`,
      footer: `<button class="btn ghost" data-x2>Nie teraz</button><span class="grow"></span><button class="btn" id="mEml">${M.icon.download}.eml ze zdjęciami</button><button class="btn primary" id="mTo2">${M.icon.mail}Otwórz w poczcie</button>`,
    });
    const val = () => ({ to: m.querySelector('#mTo').value, subject: m.querySelector('#mSub').value, body: m.querySelector('#mBody').value });
    const mark = () => { list.forEach(i => { i.mails = i.mails || []; i.mails.push({ ts: Date.now(), to: val().to }); (i.history = i.history || []).push({ ts: Date.now(), by: M.S.settings.currentUser, txt: `Przygotowano powiadomienie e-mail do: ${val().to || c?.name || '—'}` }); M.S.upsert('issues', i, true); }); M.S.touch('issues'); };
    m.querySelector('[data-x2]').onclick = () => m.close();
    m.querySelector('#mTo2').onclick = () => { ML.mailto(val()); mark(); m.close(); };
    m.querySelector('#mEml').onclick = async () => { const v = val(); const blob = await ML.eml({ ...v, attachments: await ML.issueAttachments(list) }); M.download(blob, M.safeName(v.subject) + '.eml'); mark(); m.close(); };
  };
})(window.M);
