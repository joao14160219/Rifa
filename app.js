// =================== CONFIG/CONST ===================
const STORAGE_KEY = "painel_1a150_v1"; // mude a versão se trocar estrutura
const TOTAL = 150;

// =================== ESTADO ========================
/** Estrutura: { [numero: string]: { nome: string, locked: true, ts: number } } */
let state = loadState();

// =================== DOM REFS ======================
const gradeEl = document.getElementById("grade");
const formEl = document.getElementById("formReserva");
const inputNumero = document.getElementById("numero");
const inputNome = document.getElementById("nome");
const msgEl = document.getElementById("msg");

const buscaEl = document.getElementById("busca");
const apenasLivresEl = document.getElementById("apenasLivres");
const limparFiltrosBtn = document.getElementById("limparFiltros");

const exportarBtn = document.getElementById("exportar");
const importarBtn = document.getElementById("importar");
const resetarBtn  = document.getElementById("resetar");
const fileInput   = document.getElementById("fileInput");

// =================== INIT ==========================
renderGrid();
wireForm();
wireFilters();
wireIO();

// =================== FUNÇÕES =======================
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return {};
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? parsed : {};
  }catch{
    return {};
  }
}

function isValidState(obj){
  if(typeof obj !== "object" || !obj) return false;
  // valida rapidamente formato
  return Object.values(obj).every(v =>
    v && typeof v.nome === "string" && v.locked === true && typeof v.ts === "number"
  );
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderGrid(){
  const q = (buscaEl.value || "").trim().toLowerCase();
  const onlyFree = !!apenasLivresEl.checked;

  gradeEl.innerHTML = "";
  for(let n=1; n<=TOTAL; n++){
    const rec = state[n];
    const livre = !rec;
    if(onlyFree && !livre) continue;

    // Filtro por busca (número ou nome)
    if(q){
      const nmatch = String(n).includes(q);
      const nmmatch = !livre && (rec.nome.toLowerCase().includes(q));
      if(!(nmatch || nmmatch)) continue;
    }

    const tile = document.createElement("div");
    tile.className = "tile " + (livre ? "livre" : "ocupado");

    const head = document.createElement("div");
    const numSpan = document.createElement("span");
    numSpan.className = "num";
    numSpan.textContent = `#${n}`;
    head.appendChild(numSpan);

    const nome = document.createElement("div");
    nome.className = "nome";
    // Quando ocupado, renderiza o nome centralizado e em strong
    nome.innerHTML = livre ? "Livre" : `<strong>${escapeHTML(rec.nome)}</strong>`;

    tile.appendChild(head);
    tile.appendChild(nome);

    // Botão “claim” só se livre
    const btn = document.createElement("button");
    btn.className = "claim";
    btn.textContent = livre ? "Reservar" : "Travado";
    btn.disabled = !livre;

    if(livre){
      btn.addEventListener("click", ()=>{
        inputNumero.value = n;
        inputNome.focus();
        pulse(formEl);
      });
    }
    tile.appendChild(btn);

    gradeEl.appendChild(tile);
  }
}

// simples escape para evitar HTML injetado em nomes
function escapeHTML(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function wireForm(){
  formEl.addEventListener("submit", (e)=>{
    e.preventDefault();
    const n = Number(inputNumero.value);
    const nome = (inputNome.value || "").trim();

    // Validações
    if(!Number.isInteger(n) || n < 1 || n > TOTAL){
      return showMsg("Número inválido. Use 1–150.", true);
    }
    if(!nome){
      return showMsg("Informe um nome válido.", true);
    }
    if(state[n]){
      return showMsg(`O número #${n} já está travado para "${state[n].nome}".`, true);
    }

    // Grava e trava
    state[n] = { nome, locked: true, ts: Date.now() };
    saveState();

    // UI
    inputNome.value = "";
    inputNumero.value = "";
    showMsg(`Número #${n} reservado para "${nome}" e travado.`, false);
    renderGrid();
  });
}

function showMsg(text, isError=false){
  msgEl.textContent = text;
  msgEl.style.color = isError ? "#fca5a5" : "#a7f3d0";
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(()=>{ msgEl.textContent=""; }, 4000);
}

function pulse(el){
  el.style.boxShadow = "0 0 0 3px rgba(16,185,129,.35)";
  setTimeout(()=> el.style.boxShadow = "", 400);
}

function wireFilters(){
  buscaEl.addEventListener("input", renderGrid);
  apenasLivresEl.addEventListener("change", renderGrid);
  limparFiltrosBtn.addEventListener("click", ()=>{
    buscaEl.value = "";
    apenasLivresEl.checked = false;
    renderGrid();
  });
}

function wireIO(){
  exportarBtn.addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reservas_1a150_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  importarBtn.addEventListener("click", ()=> fileInput.click());
  fileInput.addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const text = await file.text();
      const obj = JSON.parse(text);
      if(!isValidState(obj)) throw new Error("Formato inválido");
      // IMPORTANTE: não sobrescreve reservas existentes (respeita o “travado”).
      const conflicts = [];
      for(const [k,v] of Object.entries(obj)){
        const num = Number(k);
        if(!num || num<1 || num>150) continue;
        if(state[num]){ conflicts.push(num); continue; }
        state[num] = { nome: String(v.nome), locked:true, ts: Number(v.ts)||Date.now() };
      }
      saveState();
      renderGrid();
      showMsg(conflicts.length
        ? `Importado com ressalvas. Conflitos não sobrescritos: ${conflicts.slice(0,10).join(", ")}${conflicts.length>10?"…":""}`
        : "Importação concluída.");
    }catch(err){
      showMsg("Falha ao importar JSON.", true);
    }finally{
      fileInput.value = "";
    }
  });

  resetarBtn.addEventListener("click", ()=>{
    const conf = prompt(
      "ATENÇÃO: isto apaga TUDO e não pode ser desfeito.\n" +
      "Para confirmar, digite: APAGAR TUDO"
    );
    if(conf === "APAGAR TUDO"){
      state = {};
      saveState();
      renderGrid();
      showMsg("Base zerada.");
    }else if(conf !== null){
      showMsg("Texto de confirmação incorreto.", true);
    }
  });
}
