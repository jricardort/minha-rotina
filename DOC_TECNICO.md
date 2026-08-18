# Minha Rotina — Documentação Técnica

> **Última atualização:** 18/08/2026 (era **v4** do plano de treino — reestruturação rumo ao sub-60 após 44 dias sem corrida)
> **Regra de manutenção:** este documento é referência de trabalho. Toda alteração no app que mude arquitetura, chaves de dados, esquema ou fluxo crítico DEVE ser refletida aqui. Números de linha são aproximados e derivam — use os **nomes de funções/constantes como âncoras** (grep) em vez de confiar na linha.

## 1. Visão geral

- **Tipo:** SPA estática em **arquivo único** — todo HTML, CSS e JS vivem em `index.html` (~3,7k linhas). Sem build, sem bundler, sem dependências locais.
- **Stack:** Vanilla JS + Chart.js (CDN) + Tabler Icons (CDN) + Firebase compat SDK (CDN: app, auth, firestore).
- **Hospedagem:** GitHub Pages — repo `github.com/jricardort/minha-rotina`, branch `main`, publica em `https://jricardort.github.io/minha-rotina/`. Deploy = `git push` (ao vivo em ~1 min).
- **PWA:** `manifest.json` + `sw.js` (service worker de cache; registrado no fim do `index.html`). Ícones: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.
- **Idioma/formatação:** pt-BR. Números usam vírgula decimal na UI — **sempre** converter entrada com `parseBR()` e exibir com `formatBR()`/`.replace('.',',')`.

## 2. Estrutura do arquivo `index.html`

| Bloco | Conteúdo | Âncora |
|---|---|---|
| ~1–370 | `<head>`, CSS inline, manifest/ícones | `<style>` |
| ~377–383 | Barra de navegação (6 abas) | `id="tab-..."`, `switchTab` |
| ~386–433 | Seções das abas: `sec-calendario`, `sec-treino`, `sec-dieta`, `sec-compras`, `sec-medicoes`, `sec-tarefas` | `class="sec"` |
| ~434–455 | Modais (todos `div.modal-bg`): plano-nutri, foods, food-edit, add-exercise, compra, **meal-builder**, extras, meal, beer, goals, kcal-workout, override, run, workout, med, event, task… | `id="modal-*"` |
| ~457–520 | Constantes de domínio: `HOLIDAYS`, `MONTHS`, `START_DATE`, `RACE_DATE`, `MUNIQUE`, `BERLIM`, blocos de musculação (`MUSC_*`, `CORE_BLOCK`) | |
| ~502–650 | Geração do plano de treino: `dk()`, `dateFromKey()`, `generatePlan()`, `planForDayKey()`, `getWorkoutForDate()` | |
| ~650–760 | Migrações pontuais + `ensureDay`, `DEFAULT_GOALS`, estado `userFoods`/`foodOverrides` | `migrate*` |
| ~758–940 | Banco de alimentos (modal "Meus alimentos"): `getAllFoodCategories`, `renderFoodsList`, `saveFoodEdit` | |
| ~940–1360 | Exercícios extras, cerveja (`BEER_TYPES`), suplementos, gasto calórico (`calcBalance`, `estimateRunKcal`), aderência, zonas FC (`BPM_ZONES`, `computeZones`) | |
| ~1362–1930 | Aba Treino: `renderPlan`, modais de carga (`saveWeight`/`weightLog`), corrida (`saveRun`, splits, pace), override de treino, editor semanal | |
| ~1985–2100 | Aba Medições/Balança: `medMeta`, `medData`, `renderMedChart`, `toggleNutriOnly`, `saveMed` | |
| ~2100–2230 | Eventos do calendário e Tarefas | |
| ~2232–2600 | Dieta — refeições: `saveMeal` (manual), `MEAL_BUILDER_OPTIONS`, **meal builder** (`renderMealBuilder`, `saveMealBuilder`, `getAllMealBuilderOptions`), extras/off, favoritos | |
| ~2600–2950 | Cerveja, metas, água, kcal treino, painel de metas (`renderGoalsPanel`), dashboard emagrecimento, `renderDiet` | |
| ~2947–3170 | Calendário (`renderCal`, `renderDetail`), histórico de dieta | |
| ~3174–3370 | Compras (`COMPRA_CATEGORIES`, `renderCompras`, status flow) | |
| ~3369–3400 | `switchMedSubtab`, `switchTab`, boot inicial | |
| ~3400–3700 | **Firebase sync** (ver §4) | `KEYS`, `stableStr`, `syncNow` |
| ~3710–fim | Registro do service worker | `serviceWorker` |

## 3. Modelo de dados (localStorage = fonte de verdade em sessão)

Chaves sincronizadas com a nuvem (constante `KEYS`, ~linha 3447):
`events, tasks, medData, weightLog, workoutTemplate, cardioLog, coreLog, workoutOverrides, diet, dietGoals, dietFavorites, workoutKcal, exerciseRenames, comprasList, comprasHistorico, userZones, dayExtraExercises, userFoods, foodOverrides`

Esquemas principais:

- **`diet`** — `{ 'YYYY-MM-DD': { meals:[], beers:[], water:ml, supplements:{} } }`
  - `meal`: `{id, name, time:'HH:MM', kcal, prot, carb, gord, items:'a · b · c', type}`
  - `type` ∈ `cafe|lanche_manha|almoco|pre_treino|pos_treino|jantar|jantar_pos|ceia|extra|off|custom` (só `'off'` tem lógica própria — limite semanal em `countOffMealsThisWeek`)
- **`medData`** — array de `{data:'YYYY-MM-DD', peso, gordura, musculo, proteina, agua, basal, nutriSent?:true}` — `nutriSent` marca medição enviada à nutricionista (renderiza ponto verde + badge "✓ nutri")
- **`weightLog`** — `{ exKey: [{date, weight, ...}] }` — cargas de musculação; `exKey` vem de `getExKey()` — **preservar a chave ao renomear exercícios** (há `exerciseRenames` para display)
- **`workoutOverrides`** — `{ 'YYYY-MM-DD': {type, title, duration, note} }` — substituições de treino por dia; `type:'cumprido'` marca plano feito
- **`userFoods`** / **`foodOverrides`** — alimentos do usuário e overrides da base (por `name`); categorias = nomes de grupos de `MEAL_BUILDER_OPTIONS`
- **`dietGoals`**, **`dietFavorites`**, **`userZones`** (zonas FC), **`cardioLog`**, **`coreLog`**, **`workoutKcal`** (gasto manual por dia), **`comprasList`/`comprasHistorico`**

Preferências locais **não sincronizadas**: `medNutriOnly` ('1'/'0') — filtro do gráfico da balança.

## 4. Sincronização Firebase

- **Projeto:** `zes-rotina` · Auth Google · Firestore doc único: `users/{uid}/data/main`. Domínio autorizado: `jricardort.github.io` (⚠️ login NÃO funciona em localhost — testar lógica de sync só em produção).
- **Fluxo:** cada `localStorage.setItem` relevante é seguido de `window.syncNow()` (debounced) → grava o snapshot das `KEYS` no Firestore. No login/snapshot remoto, `applyCloudData()` grava no localStorage e chama `window.refreshDataFromStorage()` que re-hidrata as variáveis globais **in-place e re-renderiza sem reload**.
- **`stableStr()`**: comparação JSON com chaves ordenadas — evita falso "difere" por reordenação de chaves do Firestore (`cloudDiffers`). Não remover.
- **Regra de ouro:** ao criar uma nova chave de dado sincronizável, adicioná-la em **três lugares**: constante `KEYS`, `refreshDataFromStorage()` e no carregamento inicial da variável global.
- **Leitura externa:** `node firebase-zes/ler-dados.js` (fora do repo, em `C:\Users\User\firebase-zes\`) lê o snapshot real do Firestore (chave de service account fora do repo).

## 5. Caminhos críticos e invariantes

1. **Plano de treino é retroativo por "eras"** — `generatePlan`/`planForDayKey` derivam o treino da DATA. Mudanças de plano devem ser aplicadas por data de corte (era v1/v2/v3/v4), nunca editando a lista global, senão o histórico passado muda. Mesma lógica para listas de exercícios.
   - Cortes atuais: `<11/06` → `planOld` · `=11/06` → `plan`(v2) · `12/06–28/06` → `planNew` · `29/06–18/08` → `planV3` · `>=19/08` (`V4_START`) → `planV4`.
   - **A era v4 substitui as semanas 15–22 inteiras** (bloco `if(isV4){...return p;}` dentro de `generatePlan`). Semanas 1–14 são idênticas entre v3 e v4 — por isso `isV3` inclui `isV4`.
   - ⚠️ **Cabeçalho da semana vs. dia**: fase/cor/número vinham de `plan[i]` (sempre v2) enquanto o dia vinha de `planForDayKey`. Corrigido com `weekMeta(i)` (usa `planV4` para `i>=14`). Ao criar uma era nova que renomeie fases, atualizar `weekMeta`.
2. **`getExKey()` é a chave do histórico de cargas** — renomear exercício na UI usa `exerciseRenames`; mudar a string base do exercício órfã o histórico em `weightLog`.
   - `exerciseRenames` sobrevive a mudanças de plano e pode **mascarar** um exercício que voltou ao template com nome de outro. Ao reintroduzir exercícios, checar renames órfãos (ver `migrateRenamesV4` e `V4_STALE_RENAMES`).
3. **Meal builder** (`modal-meal-builder`):
   - `MEAL_BUILDER_OPTIONS` = plano da nutri por tipo de refeição (revisão de **03/07/2026**); itens por unidade (`kcal/prot/carb/gord`) ou por 100g (`kcalP100...` + `defaultG` = quantidade auto-preenchida).
   - Tipos: `cafe`, `lanche_manha` (pão + cottage 40g), `almoco` (carbo 80g/massa 100g, leguminosa 80g, proteína 120g, 3 ovos), `pre_treino` (fruta + ½ whey musculação; fruta + pão + cottage corrida), `pos_treino` (whey + banana se jantar >1h + iogurte proteico substituto), `jantar` (porção menor), `jantar_pos` (carbo 80g, leguminosa 100g, proteína 100g, 2 ovos), `ceia`, `extra`.
   - `getMealOptionsForCategory(type)` aplica `foodOverrides` e anexa `userFoods` por categoria (match exato com nome do grupo).
   - **Tipo `custom` (refeição personalizada):** `getAllMealBuilderOptions()` mescla TODOS os grupos de todos os tipos (dedup por grupo — normaliza sufixos `" · porção menor)"`, `" · jantar pós-treino)"` e `" · pré-corrida)"` — e por nome de item, first-wins na ordem de definição de `MEAL_BUILDER_OPTIONS`) + todos os `userFoods`. Nome obrigatório via `#mb-custom-name`; salvo como `name:'🍽️ <nome>'`, `type:'custom'`.
4. **Gráfico da balança** (`renderMedChart`): 3 datasets — linha carry-forward, pontos reais, overlay verde `nutriSent`. O filtro `medNutriOnly` (checkbox `#med-nutri-only`, `toggleNutriOnly()`) filtra só o **gráfico** (`chartData`); resumo (`renderMedSummary`) e histórico continuam com `medData` completo.
5. **Balanço calórico** (`calcBalance`): gasto = basal (última medição) + treino (manual em `workoutKcal` OU estimado de musculação+corrida do dia). Alterar estimativas afeta o dashboard de emagrecimento.
6. **Migrações**: padrão = função `migrate*()` idempotente chamada no boot (ex.: `migrateJunho`, `applyChurrascoPizzaMigration`). Novas correções de dados históricos seguem esse padrão.
7. **Segurança de render:** strings de usuário passam por `escapeHtml()` antes de entrar em `innerHTML`. Manter.
8. **IMC:** `calcIMC` usa altura fixa embutida (`peso/3.0276` ⇒ 1,74 m). A meta de peso fica em `renderEmagDashboard` (`target`, hoje **74 kg**; início 83,5).
9. **Linhas de nota no template não são exercício** — `isNoteLine()` (prefixos `⚡ 📍 ✈️ 💧 😴 🎽 🍝 📊 ⛔ ⚽ ─ ·` ou linha terminada em `:`) é avaliada **antes** de `isRunning()`, senão uma nota contendo "km" ("⚡ MARCO: os primeiros 10km") vira botão de registro de corrida. Notas caem no ramo `isCard` e renderizam como texto puro.
10. **`PACE_ZONES` e `EASY_GLIDE` são calibrados pela meta da prova** — recalibrados em 18/08/2026 para sub-60 (Z2 = 7:05-7:40/km; glide 7:40 → 7:05/km). Antes: Z2 = 6:00-6:20/km e glide até 6:30/km, calibrados para sub-55 — exibiam como "fácil" um pace praticamente de prova, o que empurrava todo treino Z2 para Z3/Z4. **Ao mudar a meta da prova, recalibrar os dois juntos.**
11. **Painel de metas ignora dados velhos** — `renderGoalsPanel` mostra aviso de "sem corrida há N dias" quando a última corrida tem mais de 14 dias, em vez de exibir pace antigo como se fosse o estado atual.

### Migrações da era v4 (18/08/2026)

| Função | O que corrige |
|---|---|
| `migrateRenamesV4` | Remove renames órfãos (`V4_STALE_RENAMES`) que mascarariam Stiff halteres, Afundo búlgaro, Panturrilha sentado e Tríceps corda no plano v4 |
| `migrateEventsV4` | Move o lembrete `tt-reassess-reminder` de 07/09 → **14/09** (o TT de 5K passou de 04/09 para 11/09) e adiciona o evento `ironman-leipzig` em 23/08 |
| `migrateMedMusculoJul24` | Corrige `medData` de 24/07: campo `musculo` recebeu 55,6 (valor em **kg**) num campo que guarda **%**; ajustado para 73,5 |

Todas são idempotentes e estão registradas **duas vezes**: no escopo do módulo (boot) e dentro de `refreshDataFromStorage()` (após carga da nuvem) — sem o segundo ponto, o snapshot do Firestore sobrescreve a correção.

## 6. Workflow de desenvolvimento

1. **SEMPRE** antes de editar: `git fetch origin && git status` no clone `C:\Users\User\minha-rotina\` (exigência do usuário — evita clobber).
2. Editar `index.html` (único arquivo de app).
3. Teste local: servidor estático (`.claude/launch.json` → `python -m http.server 8765 --directory minha-rotina`). App roda offline/deslogado em localhost (banner "MODO OFFLINE" é esperado; login Google não funciona fora do domínio autorizado).
4. Commit em português descritivo + push para `main` → GitHub Pages publica em ~1 min.
5. Atualizar `DOC_TECNICO.md` / `DOC_COMERCIAL.md` se a mudança tocar arquitetura, esquema ou funcionalidades.
6. Cache PWA (`sw.js`): `index.html` é **network-first** — deploys aparecem imediatamente mesmo no PWA instalado; CDNs/ícones são stale-while-revalidate; Firebase/Google nunca passam pelo cache. Só é preciso trocar a constante `CACHE` (`treino-v1`) se o próprio `sw.js` mudar.

## 7. Arquivos do repositório

| Arquivo | Papel |
|---|---|
| `index.html` | App inteiro (HTML+CSS+JS) |
| `sw.js` | Service worker (cache PWA) |
| `manifest.json` | Manifest PWA |
| `icon-192/512.png`, `apple-touch-icon.png` | Ícones |
| `DOC_COMERCIAL.md` / `DOC_TECNICO.md` | Estes documentos |
| `REVISAO_CODEX.md` | Revisão externa avulsa (untracked, não faz parte do app) |
