# Minha Rotina — Documentação Técnica

> **Última atualização:** 06/10/2026 (semana da prova reorganizada após 6 dias sem treino)
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
| ~3400–3700 | **Firebase sync** (ver §4) | `KEYS`, `LOG_KEYS`, `countRecords`, `stableStr`, `syncNow` |
| ~3710–fim | Registro do service worker | `serviceWorker` |

## 3. Modelo de dados (localStorage = fonte de verdade em sessão)

Chaves sincronizadas com a nuvem (constante `KEYS`, ~linha 3447):
`events, tasks, medData, weightLog, workoutTemplate, cardioLog, bikeLog, coreLog, workoutOverrides, diet, dietGoals, dietFavorites, workoutKcal, exerciseRenames, comprasList, comprasHistorico, userZones, dayExtraExercises, userFoods, foodOverrides`

Esquemas principais:

- **`diet`** — `{ 'YYYY-MM-DD': { meals:[], beers:[], water:ml, supplements:{} } }`
  - `meal`: `{id, name, time:'HH:MM', kcal, prot, carb, gord, items:'a · b · c', type}`
  - `type` ∈ `cafe|lanche_manha|almoco|pre_treino|pos_treino|jantar|jantar_pos|ceia|extra|off|custom` (só `'off'` tem lógica própria — limite semanal em `countOffMealsThisWeek`)
- **`medData`** — array de `{data:'YYYY-MM-DD', peso, gordura, musculo, proteina, agua, basal, nutriSent?:true}` — `nutriSent` marca medição enviada à nutricionista (renderiza ponto verde + badge "✓ nutri")
- **`bikeLog`** — `{ exKey: [{date, km, kcal, z1..z5, total, avgSpeed, splits:[{t,bpm}], splitKm, label, note}] }` — pedais. `avgSpeed` em km/h (string pt-BR com vírgula), `splits` por km com tempo e FC; a velocidade de cada parcial é **derivada** do tempo e da distância do trecho, não armazenada. `splitKm` diz se cada parcial vale 1 km ou 5 km (ver invariante 25); ausente = 1 km, para entradas anteriores a 30/08/2026. `label` guarda o nome da linha do plano para o histórico global conseguir nomear o percurso.
- **`weightLog`** — `{ exKey: [{date, weight, ...}] }` — cargas de musculação; `exKey` vem de `getExKey()` — **preservar a chave ao renomear exercícios** (há `exerciseRenames` para display)
- **`workoutOverrides`** — `{ 'YYYY-MM-DD': {type, title, duration, note} }` — substituições de treino por dia; `type:'cumprido'` marca plano feito
- **`cardioLog`** — `{ exKey: [{date, km, z1..z5, total, splits:[pace], splitBpm:[bpm], avgPace, note}] }` — `splits` são **strings de pace** e `splitBpm` é um array **paralelo** de FC por km (ver invariante 26).
- **`dayExtraExercises`** — `{ 'YYYY-MM-DD': [{id, type, label, addedAt}] }` — atividades avulsas do dia. `type` ∈ `musc|bike|corrida|alongamento|mobilidade|core|sauna|livre`, mas quem decide o controle de registro na tela é o **label**, não o type (ver invariante 21).
- **`userFoods`** / **`foodOverrides`** — alimentos do usuário e overrides da base (por `name`); categorias = nomes de grupos de `MEAL_BUILDER_OPTIONS`
- **`dietGoals`**, **`dietFavorites`**, **`userZones`** (zonas FC), **`cardioLog`**, **`coreLog`**, **`workoutKcal`** (gasto manual por dia), **`comprasList`/`comprasHistorico`**

Preferências locais **não sincronizadas**: `medNutriOnly` ('1'/'0') — filtro do gráfico da balança.

## 4. Sincronização Firebase

- **Projeto:** `zes-rotina` · Auth Google · Firestore doc único: `users/{uid}/data/main`. Domínio autorizado: `jricardort.github.io` (⚠️ login NÃO funciona em localhost — testar lógica de sync só em produção).
- **Fluxo:** cada `localStorage.setItem` relevante é seguido de `window.syncNow()` (debounced) → grava o snapshot das `KEYS` no Firestore. No login/snapshot remoto, `applyCloudData()` grava no localStorage e chama `window.refreshDataFromStorage()` que re-hidrata as variáveis globais **in-place e re-renderiza sem reload**.
- **`stableStr()`**: comparação JSON com chaves ordenadas — evita falso "difere" por reordenação de chaves do Firestore (`cloudDiffers`). Não remover.
- **Regra de ouro:** ao criar uma nova chave de dado sincronizável, adicioná-la em **três lugares**: constante `KEYS`, `refreshDataFromStorage()` e no carregamento inicial da variável global.
- **Trava de encolhimento:** `syncToCloud()` lê a nuvem antes de gravar e **aborta** se alguma chave de `LOG_KEYS` sairia com menos registros do que a nuvem tem (invariante 29). Custo: 1 leitura do Firestore por sync.
- **Leitura externa:** `node firebase-zes/ler-dados.js` (fora do repo, em `C:\Users\User\firebase-zes\`) lê o snapshot real do Firestore (chave de service account fora do repo).

## 5. Caminhos críticos e invariantes

1. **Plano de treino é retroativo por "eras"** — `generatePlan`/`planForDayKey` derivam o treino da DATA. Mudanças de plano devem ser aplicadas por data de corte (era v1/v2/v3/v4), nunca editando a lista global, senão o histórico passado muda. Mesma lógica para listas de exercícios.
   - Cortes atuais: `<11/06` → `planOld` · `=11/06` → `plan`(v2) · `12/06–28/06` → `planNew` · `29/06–18/08` → `planV3` · `19/08–11/10` (`V4_START`) → `planV4` · `>=12/10/2026` (`BERLIM_START`) → `planBerlim` (ver invariante 30).
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
7b. **A prova é a 4ª perna do revezamento da Maratona de Munique** (confirmado 21/09/2026): KM 31 (Ampfingstraße) à chegada no Willi-Daume-Platz, **11,2km**, largada da equipe 09:20 e troca dele por volta de 12:20-13:00. A constante `MUNIQUE` carrega `dist:11.2` porque ela alimenta o percentual do longão no painel de metas — com `dist:10` o painel diria 100% cedo demais.
8. **IMC:** `calcIMC` usa altura fixa embutida (`peso/3.0276` ⇒ 1,74 m). A meta de peso fica em `renderEmagDashboard` (`target`, hoje **74 kg**; início 83,5).
9. **Linhas de nota no template não são exercício** — `isNoteLine()` (prefixos `⚡ 📍 ✈️ 💧 😴 🎽 🍝 📊 ⛔ ⚽ ─ ·` ou linha terminada em `:`) é avaliada **antes** de `isRunning()`, senão uma nota contendo "km" ("⚡ MARCO: os primeiros 10km") vira botão de registro de corrida. Notas caem no ramo `isCard` e renderizam como texto puro.
10. **Pace por zona é DERIVADO dos treinos, e não existe mais meta de pace fácil** — até 11/09/2026 `PACE_ZONES` era uma tabela fixa (recalibrada em 18/08 para sub-60: Z2 = 7:05-7:40/km; antes, calibrada para sub-55, exibia Z2 a 6:00-6:20/km e empurrava todo treino Z2 para Z3/Z4). A tabela fixa foi aposentada porque o pace dentro de uma mesma zona varia demais para caber numa faixa: 01/09 e 10/09 tiveram praticamente a mesma FC média (156/155 bpm) e 39 s/km de diferença. Agora `paceZonesObservadas()` calcula a faixa de cada zona a partir das parciais reais, e `addBpmToZones` só anota o pace de uma zona quando há dado suficiente — senão mostra só bpm (regras na invariante 28).
    - **`EASY_GLIDE` também foi aposentado em 11/09/2026**, por decisão do usuário: ele corre pelas zonas de FC no relógio e ignorava a "Meta de pace fácil p/ hoje" (~7:25/km nessa data, 48 s/km mais lenta do que ele corria em Z2). Saíram do card de Munique a linha da meta, o "% do caminho 7:40 → 7:05" e o selo "em dia / acima do previsto", que julgava o pace contra ela. Ficaram "Pace fácil atual", o pace-alvo da prova, o maior longão com a barra de distância e o aviso de corrida antiga.
    - ⚠️ "Pace fácil atual" é a média das 3 últimas corridas ≥2 km **de qualquer tipo** (`goalRuns()`): um teste de 5 km entra na conta. Não mudou nesta data — o rótulo promete mais do que o cálculo entrega.
11. **Painel de metas ignora dados velhos** — `renderGoalsPanel` mostra aviso de "sem corrida há N dias" quando a última corrida tem mais de 14 dias, em vez de exibir pace antigo como se fosse o estado atual.
12. **Dia de descanso é marcado por `rest:true`, não pelo título** — `dayIsRest(day)` é a única fonte de verdade (`day.rest===true || day.t==='Descanso'`). Até a v3 todo descanso era o `REST_DAY` literal; a v4 usa títulos descritivos (`'⛔ OFF — volta de Leipzig'`), e um OFF planejado sem a flag é contado como **falta** na aderência e ganha botão "Cumprido" indevidamente. ⚠️ Nem todo título com `⛔` é descanso (`'⛔ Futebol SUSPENSO — trote leve'` tem corrida) — por isso a flag explícita em vez de regex no título. Usado em 6 pontos (aderência, `renderPlan`, `renderTreinoHistorico`, `renderDetail`, status do dia, calendário).
13. **Aderência conta a partir do plano vigente** — `PLAN_RESET` (= `V4_START`) é o piso de `getAdherenceStats`. Dias anteriores à reestruturação pertencem a outro plano e contariam como falta em massa. Quando a janela de N dias é cortada pelo piso, `stats.clipped` fica `true` e o rótulo do card vira "desde o plano novo · DD/MM" em vez de "últimos 14 dias". **Ao criar uma era nova que reinicie a contagem, atualizar `PLAN_RESET`.**

14. **Ajustes pontuais de calendário usam `SPECIAL_WORKOUTS`, não uma era nova** — `SPECIAL_WORKOUTS['YYYY-MM-DD']` sobrepõe o dia em TODOS os renders (`getWorkoutForDate`, `renderPlan`, `renderTreinoHistorico`, `renderInfoPlan`, `renderDetail`) e na aderência. Por ser indexado por data, é intrinsecamente não-retroativo: não cria era, não mexe em `PLAN_RESET`/`weekMeta` e não órfã chave de `weightLog`.
    - Aplicado em **28/08/2026** para a agenda social de set/out (16 datas, de 29/08 a 06/10): Aniversário Aline, Wannda Circus, Churrasco Leozão, **Oktoberfest** e Jantar ADI.
    - Regra de negócio adotada: o longão **muda de horário** (sábado de manhã) quando o evento é à tarde/noite; só **muda de dia** quando o fim de semana inteiro está tomado — caso único do **longão-chave de 12km**, que saiu de sáb 26/09 para qui 24/09 e depois para **seg 21/09**, quando o Oktoberfest ADI (24/09, 11h30-17h) tomou o terceiro dia da semana. Nessa semana o longão absorve a qualidade e os 5×1km saem.
    - ⚠️ Ao escrever notas de evento, usar um prefixo reconhecido por `isNoteLine()` — a lista ganhou `🍺 🎂 🎪 🥩 🍽️ 🔄`, depois `🚴 🚆`, `⚖️`, `👟`, `🎧` e `✈️`. Sem prefixo, uma linha como "🍺 Oktoberfest 10h–16h" não casa com `isCardio()` e cai no ramo de musculação, ganhando botão de carga.
15. **`renderInfoPlan` (Plano Completo do modal) precisa respeitar a era** — iterava `plan` (v2) e mostrava os treinos pré-v4 nas semanas 15–22. Corrigido em 26/08/2026: cabeçalho vem de `weekMeta(wi)` e o dia de `planForDayKey(dayKey)[wi].template[di]`, com `SPECIAL_WORKOUTS` por cima. `phaseColor`/`phaseBg` também passaram a reconhecer `Pico` (v4) além de `Peak` (v2).

16. **`index.html` é fonte de dados para um consumidor EXTERNO** — a assistente Claudia (`C:\Users\User\claudia\src\treino.js`) não duplica o plano: ela **recorta o texto** do `index.html` e executa num `vm` isolado para chamar `getWorkoutForDate`. O briefing dela cruza o treino com a previsão do tempo.
    - Ela localiza os blocos por **prefixo de linha**: `const START_DATE=` até `function getWorkoutForDate` (fechando na primeira linha igual a `}`), e `const SPECIAL_WORKOUTS={` até a primeira linha começando em `};`.
    - ⚠️ **Não reformatar essas declarações** (minificar, mudar indentação da abertura, mover `SPECIAL_WORKOUTS` para dentro de outro escopo) sem rodar `node src/treino.js AAAA-MM-DD` na Claudia depois. Ela falha alto de propósito — briefing sem treino é ruim, briefing com treino errado é pior.
    - Ela detecta corrida no dia por regex sobre título+`ex` (`corrida|long ?run|longão|z2|z3|strides|intervalado|tempo run|time trial`) e sessão noturna por `🌙`/`FIM DO DIA`. Manter esse vocabulário nos títulos.
17. **Horário de sessão vai em linha de nota, não no nome do exercício** — prefixar a linha do exercício com hora (`⏰ 09:00 — Long Run 7km`) muda o `getExKey()` e órfã o histórico em `cardioLog`. Os horários entram como linhas `📍` separadas.
    - Pelo mesmo motivo, atividade que **não é corrida** (pedal, caminhada) entra como linha de nota com prefixo próprio: sem isso `isRunning()` casa com o "km" e cria um botão de registro que gravaria um pedal de 14 km como corrida, distorcendo pace médio e volume.

18. **`bikeLog` é separado de `cardioLog` por decisão de projeto, não por acaso** — `goalRuns()` e o painel do sub-60 agregam `cardioLog` para calcular pace médio e volume de corrida. Um pedal de 14 km a ~2:00/km entrando lá destruiria os dois números, que são justamente o critério da meta. **Nunca unificar os dois logs.**
    - O pedal entra no balanço calórico pelo mesmo balde de cardio (`getDayKcalSpent` soma `bikeKcalForDay`), mas com METs de ciclismo (`z1:4 … z5:12`, contra `z1:7 … z5:16` da corrida) e dando prioridade à caloria informada pelo relógio.
    - O histórico do pedal é **global** (`allBikeRides()` varre todas as chaves), ao contrário do da corrida que é por exercício: trajeto de bike muda de nome a cada dia e por chave o histórico ficaria em cacos.
19. **Ordem das checagens de linha no `renderPlan`: `isBikeLine` → `isNoteLine` → `isRunning`** — `🚴` é prefixo de nota (senão `isRunning` casa com o "km" e cria botão de corrida), então sem avaliar `isBikeLine` primeiro o pedal nunca ganharia botão próprio. Só existe **um** caminho de render com essas checagens (`renderPlan`); ao criar outro, replicar a ordem.
20. **O modal do pedal usa `.bike-time-group`, não `.time-input-group`** — `buildZoneTimePickers()` varre `.time-input-group` globalmente e reescreve o `innerHTML` com ids `r-<zona>-*`. Reaproveitar a classe no modal do pedal geraria ids duplicados e quebraria os dois modais.

21. **Exercício extra precisa do MESMO controle de registro do plano** — até 28/08/2026 os itens de `dayExtraExercises` renderizavam como texto puro com um `×`: o usuário adicionava "Cadeira extensora" e não tinha onde lançar a carga, então o dado nunca entrava em `weightLog` e sumia da progressão. `extraControlHTML(label,dayKey)` resolve reaplicando a ordem de decisão do plano (pedal → nota → corrida → core → cardio → carga).
    - É uma **segunda** implementação da mesma decisão, deliberadamente separada do `renderPlan` para não mexer num caminho que funciona. Ao mudar a ordem em um, mudar no outro (invariante 19).
    - O label é a fonte da verdade, não o `type` do extra: assim um extra colado à mão ou vindo de versão antiga continua funcionando.
22. **O nome do extra decide se ele soma ao histórico ou abre um órfão** — `getExKey()` é a chave, então "Cadeira extensora 3x10" e "Perna: extensora - 3x10 - 32kg" viram séries diferentes. Por isso o campo de nome tem `<datalist>` alimentado por `knownExerciseNames()` (chaves de `weightLog` + exercícios do plano vigente) e `updateAeHistHint()` avisa ao vivo se o nome digitado cai num histórico existente e qual foi a última carga.
23. **Extra de bicicleta guarda só o trajeto no label** (`🚴 Bike — <trajeto>`) — distância e tempo vão no registro. Se fossem para o label, cada pedal geraria uma chave nova de `getExKey()` e o botão nunca mostraria o pedal anterior daquele trajeto.
    - ⚠️ Ao inserir `<option>` em `<select>` por busca de texto, **conferir qual select recebeu**: `<option value="corrida">🏃 Corrida</option>` existe em `#ev-cat` (categoria de evento) **e** em `#ae-type` (tipo de exercício). Ancorar pelo vizinho único.

24. **Exercício extra tem que sair nos DOIS ramos do `renderPlan`** — o ramo do treino substituído (`else if(ov)`) dá `return` antes da lista de exercícios. Até 28/08/2026, trocar o treino do dia **e** adicionar extras fazia os extras sumirem da tela, junto com o botão de registro deles. O bloco virou `extrasBlockHTML(dayKey)` e é emitido nos dois ramos, sempre **antes** do `</div>` que fecha a `.treino-day` — emitir depois joga os extras para fora do dia e desbalanceia o HTML.

25. **Parciais do pedal são segmentadas por distância, não fixas em 1 km** — `bikeSegKm(km)` devolve 5 acima de `BIKE_SPLIT_LIMIAR` (10 km) e 1 abaixo, espelhando o iOS, que passa a entregar médias a cada 5 km quando o pedal ultrapassa 10 km. Um pedal de 30 km abria 30 campos e era inviável de preencher à mão; agora abre 6.
    - `bikeSplitParts(km,seg)` é a fonte única dos trechos e é usada nos **três** pontos: montagem dos campos, cálculo da velocidade ao digitar e exibição no histórico. O último trecho pode ser parcial (23 km → `km 21–23`); sobra menor que 1 km vira `últimos X km`, porque `km 11–10,5` não se lê.
    - A velocidade de cada trecho usa a distância **dele** (`dist*3600/seg`), não 1 km fixo. Sem `splitKm` gravado na entrada, o histórico exibiria velocidade 5× menor.
    - O campo de minutos do trecho aceita até 599: 5 km em ritmo baixo passa de 59 min.

26. **FC por km da corrida vai num array PARALELO (`splitBpm`), não dentro de `splits`** — diferente do pedal, que nasceu com `splits:[{t,bpm}]`. Motivo: `cardioLog.splits` é uma lista de strings de pace desde 12/06/2026 e alimenta `avgPaceFromSplits()`, lido em quatro pontos; trocar a forma exigiria migrar o histórico e mexer em todos eles. A assimetria é deliberada — **não "uniformizar" os dois sem migração**.
    - `splitBpm[i]` corresponde a `splits[i]`. Registro sem `splitBpm` (anterior a 01/09/2026) renderiza normalmente, só sem FC.
    - `zoneForBpm(bpm)` mapeia FC → zona pelas faixas de `userZones` (do teste de FCmáx). Devolve `null` quando não há `fcmax` configurado, e a badge mostra —. Acima do topo da Z5, satura em Z5.
    - Objetivo: cruzar pace e zona parcial a parcial. A análise de 29/08 ficou em aberto porque só havia tempo por zona agregado do dia inteiro, sem saber a que ritmo cada zona foi atingida.

27. **Dia de teste tem UMA linha de corrida, nunca uma por fase** — `goalRuns()` deduplica por data ficando com a **maior distância**, então um teste de 5 km lançado como 2+2+1 entra no painel de metas como corrida de 2 km, e `avgPaceFromSplits` só fecha sobre a corrida inteira. As fases (aquecimento, blocos de ritmo, desaquecimento) são linhas de **nota** com prefixo `·`.
    - Isso também conserta um efeito colateral antigo: `Aquecimento 10min Z2` e `Desaquecimento 5min Z1` não casam com `isRunning()` nem com `isCardio()` e caíam no ramo final, ganhando botão de **carga**. Toda linha de instrução dentro de um dia de corrida precisa de prefixo de nota.

28. **Pace por zona vem das parciais reais, com guarda-corpos — nunca de uma tabela** — `paceZonesObservadas()` (logo acima de `addBpmToZones`) varre `cardioLog` e usa cada parcial que tem FC (`splitBpm[i]`) como amostra na zona dessa FC (`zoneForBpm`). A faixa exibida é o intervalo interquartil (p25–p75), com `~` na frente para marcar que é observada: `Z2 (147-159bpm · ~6:33-7:05/km)`.
    - **Descartes:** o 1º km (a FC demora a subir e lê uma zona abaixo — em 10/09 o km 1 saiu a 6:41/km com 142 bpm, Z1, e o km 2 a 6:32/km com 152, Z2); o último trecho quando a distância é fracionária (ali `splits` guarda o **tempo** do trecho, não o pace — ver `avgPaceFromSplits`); e parcial acima de 9:30/km (`PZ_CAMINHADA_SEG`), porque caminhadas são lançadas em chaves de corrida.
    - **Guarda-corpos** (`PZ_MIN_AMOSTRAS`=8, `PZ_MIN_CORRIDAS`=3, `PZ_JANELA_DIAS`=42): zona sem amostras ou corridas suficientes na janela não publica pace e a anotação fica só com bpm. Além disso, se duas zonas publicáveis vizinhas tiverem as medianas invertidas (zona mais alta com pace mais lento), **as duas** voltam a bpm puro.
    - **Por que existem:** em 11/09/2026, com 10 corridas com FC por km, os dados crus davam Z1 **mais rápida** que Z2 (25/08: 5:58/km a 138 bpm — sensor óptico travado na cadência) e Z2/Z3/Z4 praticamente sobrepostas (o longão de 29/08 manteve ~6:40/km com a FC subindo de 160 a 176 — deriva cardíaca, não intensidade). Publicar aquilo diria ao usuário que Z1 é mais rápida que Z2. Nessa data nenhuma zona passa nos guarda-corpos: o app mostra só bpm, e as faixas surgem sozinhas conforme entram corridas.
    - O resultado é memorizado por assinatura (total de FCs registradas + data da última corrida + dia + `userZones`), porque `addBpmToZones` roda em cada linha de exercício de cada render.
    - `formatPace()` arredonda os segundos **antes** de separar minuto e segundo (corrigido em 11/09/2026). Antes, o minuto vinha de `Math.floor(s/60)` e os segundos de `Math.round(s)%60`: com segundos fracionários a virada errava, e 419,6 s virava `6:00` em vez de `7:00`. O caso real era "Pace fácil atual" no painel de metas, que recebe uma média; as demais chamadas já passavam inteiros.

28. **Prescrição passou de alvo de PACE para teto de FREQUÊNCIA** (12/09/2026) — em três de quatro sessões ele correu mais rápido que o prescrito, sempre se sentindo confortável (29/08 pedia 7:05–7:40 e saiu 6:44; 08/09 e 12/09 pediam 6:00 e saíram 5:44 e 5:46). Alvo de pace é burlável sem má intenção; teto de FC o relógio não deixa passar.
    - Duas regras, e qual delas vale **define o objetivo da sessão**: em fácil/longão a **frequência é a meta** (teto 159, topo da Z2) e o pace é resultado; em ritmo de prova o **pace é a meta** (6:00 cravado) e a frequência é a **medida**, com teto 175 — empatando, manda a FC. Em tiros a FC pode passar de 175 no esforço, mas a recuperação volta abaixo de 160.
    - Aplicado em todas as sessões de corrida de 17/09 a 06/10, e documentado no modal em seção própria.
    - Racional: 6:00/km custava 175 bpm em 12/09 e precisa custar ~165 até a prova. É a única variável que ainda tem que mudar — velocidade já foi demonstrada (5 km a 5:44 em 08/09).

29. **Trava de encolhimento no sync — nenhuma gravação pode reduzir um log** (11/10/2026) — `syncToCloud(force)` faz um `getDoc` antes do `setDoc` e compara `countRecords()` de cada chave de `LOG_KEYS` (`weightLog`, `cardioLog`, `bikeLog`, `coreLog`, `dayExtraExercises`, `workoutOverrides`, `medData`, `diet`, `workoutKcal`, `comprasHistorico`). Se a gravação sairia com **menos** registros que a nuvem, nada é gravado e o status vira `⚠️ Conflito de sync — clique`.
    - **Por que:** `loadFromCloud` resolvia conflito pelo documento INTEIRO com um único carimbo `localModified`. Um aparelho com `localStorage` velho que mexesse em qualquer chave carimbava um `localModified` novo, ganhava a comparação e empurrava seu snapshot inteiro; como `setDoc` usa `merge:true` (mescla por **campo**, não por registro), a chave inteira era substituída. Duas perdas reais confirmadas: a upper de **23/09/2026** (`weightLog`, não recuperada) e `dayExtraExercises` **inteiro — 31 registros, 18 dias — entre 06 e 07/10/2026** (recuperado do backup de 06/10).
    - **Onde a trava mora e por quê:** dentro de `syncToCloud`, não em `loadFromCloud`. Todo caminho de push passa por `syncToCloud` — inclusive os **dois** de `loadFromCloud` (o push de mudanças pendentes antes da leitura, e o branch `localMod > cloudMod`). Uma trava só em `loadFromCloud` deixaria o push debounced do `localStorage.setItem` descoberto.
    - **`countRecords(v)`** é agnóstico de forma porque as chaves têm formas diferentes: array → tamanho; objeto → soma dos arrays filhos (filho não-array conta 1). Serve para `cardioLog` (`{exKey:[...]}`), `medData` (`{0:{...},1:{...}}`) e `diet` (`{data:{...}}`) sem casos especiais.
    - **Escape hatch, alcançável no celular:** o clique abre `resolveShrinkConflict()`. Primeiro confirm = trazer a nuvem para o aparelho (seguro) — aplica `applyCloudData` e **rebaixa `TS_LOCAL` para o `localModified` da nuvem**, senão o aparelho velho volta a ganhar a comparação no próximo login. Cancelar abre um segundo confirm, que sobrescreve a nuvem via `syncToCloud(true)`. Também existe `window.forceSyncToCloud()`.
    - **Falso positivo é possível e aceito:** apagar um registro de propósito (ex.: uma corrida duplicada) dispara a trava. O custo é um clique; o benefício é que perda silenciosa fica impossível. Não trocar por um aviso que grava mesmo assim.
    - ⚠️ `events`, `tasks` e `comprasList` **não** estão em `LOG_KEYS` — encolhem no uso normal.
    - Camadas 2 (carimbo por chave) e 3 (união por registro nos logs append-only) seguem **pendentes**; esta sozinha já teria evitado as duas perdas.

⚠️ **Numeração:** existem duas invariantes 28 (pace por zona e teto de FC) — colisão anterior a esta mudança, não renumerada porque há referências cruzadas no texto e nas notas do projeto.

30. **Era BERLIM — o plano deixou de terminar na prova de Munique** (11/10/2026) — `generatePlan('berlim')` devolve **47 semanas**: as 22 do bloco de Munique, byte a byte iguais às da v4, mais 25 novas (índices 22–46) do bloco da Meia de Berlim, 12/10/2026 a 04/04/2027.
    - **O índice de semana corre desde `START_DATE` (11/05/2026)**, não desde o início da era. Por isso a era Berlim ocupa 22–46 e não 0–24: `getWorkoutForDate` calcula `weekIdx` por diferença de dias contra `START_DATE`. Conferido: idx22 = 12/10/2026, idx31 = 14/12 (embarque), idx38 = 01/02 (volta), idx46 domingo = **04/04/2027**, dia da prova.
    - ⚠️ **O bloco `if(isBerlim){...}` fica ANTES do `return p;` antecipado do `if(isV4)`** — e não no fim de `generatePlan`. Como `isV4` inclui `isBerlim` (as 22 primeiras semanas são as mesmas), a função retornava ali e a variante `berlim` saía com 22 semanas. Foi exatamente esse o bug na primeira tentativa. Ao criar a próxima era, lembrar que existem **dois** `return p;`.
    - **Três limites travavam o plano em 11/10/2026** e passaram a usar `PLAN_END` (= 04/04/2027): o `dt>RACE_DATE` de `getWorkoutForDate`, o `weekIdx>=plan.length` (que usava `plan`, de 22 semanas — agora `planBerlim.length`) e o `d>RACE_DATE` do cálculo de aderência. `RACE_DATE` segue sendo Munique, de propósito: é o que o contador usa para saber que a prova passou.
    - ⚠️ **Era QUATRO limites, não três** — o quarto só apareceu em 12/10/2026, o primeiro dia da era: a janela de semanas do `renderPlan` usava `plan.length` (a variante **v2**, de 22 semanas). Com `cw=22`, `ei` fechava em 22 e a **semana atual ficava fora da janela** — a sub-aba Semanas abria sem plano nenhum. Corrigido para `planBerlim.length`. Lição: `plan` (v2) ainda é usado como referência de tamanho em pontos antigos; ao criar uma era, **procurar `plan.length` e `plan[` sem prefixo**, não só `RACE_DATE`. E o harness de verificação cobria `generatePlan` e `getWorkoutForDate`, mas não as janelas de renderização — testar também a tela, no dia da virada.
    - **Regra dos nomes de exercício (pedido explícito dele em 11/10):** a era Berlim **reusa as constantes `MUSC_*`** em vez de redeclarar listas. Verificado contra o `weightLog` real: as **13** chaves de carga em vigor na v4 (idx15–21) continuam todas em uso, mais `cadeira extensora`, que ganhou tela com os 6 registros que já existiam. **Zero órfãos** (ver invariante 2). Ao criar a próxima era, rodar essa comparação antes de commitar.
    - **Linhas `📐 INCLINAÇÃO` nas sessões de esteira** — prefixo próprio para não se misturar com o `📊` do teto de FC. Fixa em 1% nas fáceis e nos tiros (esteira plana subestima o esforço de rua); variando 1→3% nos longões. Conferido: **19 de 19** sessões de esteira têm a linha.
    - **A regra de ouro "na rua, não na esteira" virou duas**, porque era HTML estático no modal e não passa pelas eras: vale para Munique, e **inverte no Brasil** (14/12–01/02, esteira por segurança). Qualquer regra nova no modal que dependa de período tem esse mesmo problema.
    - **Contador e card de peso** passaram a promover Berlim quando `RACE_DATE` já passou (`emBerlim`/`raceTitle`), mantendo a linha de Munique como histórico cumprido.

31. **Sub-aba "Resultados" da aba Treino — `PROVAS` é dado de referência em código, não chave sincronizada** (11/10/2026) — guarda o resultado de cada prova com a análise das parciais (tempo, pace, parciais km a km com FC, blocos de análise, observações, a nota do registro e a previsão dada na véspera). `PROVAS_FUTURAS` alimenta o rodapé de próximas provas.
    - **Por que em código e não em `localStorage`:** prova é evento raro (três até set/2027) e o conteúdo é análise, não lançamento. Virar chave sincronizável exigiria entrar em `KEYS`, em `refreshDataFromStorage()` e na carga inicial (a regra de ouro do §4), além de `LOG_KEYS` da invariante 29 — risco desproporcional ao ganho. Para registrar uma prova nova, acrescentar um objeto no início de `PROVAS`.
    - ⚠️ **Existiam QUATRO chamadas espalhadas** de `if(treinoSubtab==='hist')renderTreinoHistorico();else renderPlan();` (em dois pontos de refresh, no `switchTab` e no `showSection`). Com a terceira aba, cada uma teria que conhecer a nova. Foram todas trocadas pelo despachante único **`renderTreinoSubtab()`**. Ao criar uma quarta sub-aba, mexer só nele.
    - A FC da prova de 11/10 está marcada como inconfiável na própria aba (o km 3 aparece como `sem sinal`, em vermelho) — ver invariante 28 sobre sensor óptico travado na cadência.
    - **Tudo abaixo da linha Distância/Tempo/Pace fica num `<details class="prova-det">`** (11/10/2026, pedido dele): a prova mais recente (`pi===0`) abre por padrão, as anteriores ficam fechadas. Card aberto mede ~1890px num celular de 375px; fechado, 240px. A seta gira por CSS (`.prova-chev` + `details.prova-det[open]`), e o `summary` leva `list-style:none;-webkit-appearance:none` para esconder o marcador nativo, como os outros `<details>` do app. O `summary{}` global tem `margin-bottom:8px` e `color:#78350F` — por isso o inline precisa de `margin:0` e cor própria.
    - O cabeçalho da aba Treino era fixo em "10km sub-60 · Maratona de Munique · 11/Out/2026" e passou a apontar Berlim. **É HTML estático, não passa pelas eras** — mesmo problema da regra de ouro na invariante 30; trocar à mão a cada bloco novo.

32. **Protocolo do CloudMonster — linha `👟 TÊNIS` em toda sessão de corrida da era Berlim** (18/10/2026) — `easyRua/easyEst/lrRua/lrEst` ganharam um 2º parâmetro opcional `ten`, concatenado quando presente. Conferido por harness: **69 de 69** sessões com linha.
    - **Por que existe:** o CloudMonster 3 estreou em 08/09 e a dor lateral apareceu 11 dias depois — transição rápida demais. Solado alto = mais alavanca no tornozelo = mais carga nos peroneais. Adaptar em vez de aposentar porque **rodízio de dois tênis reduz risco** (varia o padrão de carga) e porque numa meia de 21km o solado alto trabalha a favor.
    - **Fases, entrando sempre pela sessão mais curta:** f0 S24 (só caminhando) · f1 S25–S26 (só a fácil de quarta) · f2 S27–S29 (+ qualidade de quinta) · f3 S30–S31 (+ longão, alternando) · Brasil S32–S38 (esteira é o melhor piso; 1 corrida/semana no antigo) · build em diante, rodízio livre. **O longão de 20km da S45 decide o tênis da prova**; da S46 em diante roda só nele. O número da fase aparece no nome da fase da semana (`tênis f1/f2/f3`).
    - **Regra de parada, na própria linha:** dor lateral antes do km 3 encerra a sessão e volta ao antigo.
    - ⚠️ **Os acentos e emoji do bloco Berlim são escapes JS literais** (`\u00E7`, `\u{1F45F}`), não caracteres decodificados — diferente do modal, que tem os caracteres reais. Patch em Python nesse bloco **exige raw string**, senão o padrão não casa. Foi a segunda vez que isso me custou uma rodada.
    - **SÃO SILVESTRE 31/12/2026 entrou no bloco** (inscrição paga em 26/10) — 15km, largada do pelotão geral 08h08 em ondas, pace declarado 6:30/km. **Resolve o furo estrutural do Brasil**: as semanas de Natal e Ano Novo eram as duas de maior risco das 25 (férias + festas + piso mínimo) e viraram as de maior motivo para treinar. Os longões do Brasil foram invertidos: sobem ATÉ a prova (13→10→12→prova 15) e só depois recomeçam (10→13→16→10). A **semana-chave de 16km da S37 continua intacta**, e nenhuma âncora se moveu.
    - **Aclimatação ao calor é a variável nº 1 dessa prova** — ele treina em esteira com ar e correria 15km a ~25°C sem adaptação, o que custa 30-60s/km. Por isso os longões da S32 e S33 saem da esteira e vão para a RUA, de manhã, marcados como sessões de aclimatação. O da S33 é ensaio geral: mesmo tênis, horário e hidratação do dia 31.
    - **A prova é no Duramo**, não no CloudMonster: nada novo no dia, e em 31/12 o CloudMonster só terá esteira nas pernas. Isso vale como regra geral — o tênis de prova é sempre o que tem RUA recente.
    - Entrou também em `PROVAS_FUTURAS`, então aparece na aba Resultados com contagem de dias.
    - **Futebol SAIU do plano inteiro** (26/10/2026, decisão dele — quando jogar, avisa e a semana é reavaliada). A constante `FUT` foi substituída por `BIKE`/`BIKE_CURTA`: **terça virou bike indoor Z2**, que soma volume aérobico com zero impacto, exatamente o que uma lateral sem diagnóstico pede. **Sexta ganhou `TROTE_SEX(km)`** (trote regenerativo + upper leve): a base foi de 3 para **4 corridas por semana**, porque ele pediu um plano mais exigente, não mais fácil — recusou explicitamente a ideia de "piso" para Munique. **O piso vale só para o Brasil.** As menções a futebol nas eras v2–v4 **ficam**: são histórico.
    - **Revisão de 26/10/2026 — a S24 também passou sem treino (15 dias sem correr).** A **S25 deixou de ser a 1ª semana de base e virou a volta gradual**; a base caiu de 7 para 6 semanas (S26–S31) e o pico pré-viagem foi de 14km para **13km** — o Brasil recomeça em 8km de qualquer jeito, então esse pico pesa pouco. Datas-âncora intactas: embarque 14/12 e prova 04/04. **A S24 não foi reescrita** — é passado e o plano é retroativo (invariante 1); só o futuro se ajusta.
    - **Fases do tênis reorganizadas na mesma revisão:** a base agora tem só f1 (S26–S27, facil de quarta) e f2 (S28–S31, + qualidade). **O longão fica no Duramo até o Brasil de propósito** — o 1º longão no CloudMonster não pode ser o maior do bloco, e a esteira do Brasil é o piso mais gentil com os peroneais para fazer essa estreia.
    - **S24 (19–25/10) perdeu o futebol** porque a S23 inteira passou sem treino: seria a 1ª atividade em 11 dias, e sprint com mudança de direção é a carga que mais cobra os peroneais. Entrou Reabilitação B no lugar. **A corrida não mudou** — a S23 não tinha corrida nenhuma, então não houve perda de volume e o bloco de 25 semanas **não foi deslocado**.

36. **Importação do Strava — sem servidor, com o segredo no Firestore** (28/10/2026) — botão **dentro do modal de corrida**, que é o que resolve o problema mais chato: ali o `currentRunKey` já está escolhido, então a importação não precisa adivinhar a qual linha do dia a atividade pertence.
    - **Por que dá para ser 100% no navegador:** medido, não suposto. O Strava **libera CORS** (`GET /athlete/activities` e `POST /oauth/token` respondem da origem do app — 401/400, ou seja, chegaram). Mas **não há PKCE nem implicit grant**, então o `client_secret` é obrigatório. Ele vive no campo **`stravaCfg`** de `users/{uid}/data/main`, e os tokens em **`stravaTok`** — ambos **FORA do array `KEYS`**: nunca vão para o `localStorage`, não entram no payload de sync, e sobrevivem porque o `setDoc` usa `merge:true`.
    - **Onde mora o código:** o cliente de rede vai no **módulo** (precisa de `db`, `currentUser`, `getDoc`, `setDoc`) e expõe `window.strava*`; a UI fica no **script clássico**, onde estão os campos do modal. `loadFromCloud` chama `stravaLerDoDoc(snap.data())` e `stravaTratarRetorno()` — este troca o `?code=` por tokens quando voltamos da autorização, e limpa a URL com `replaceState`.
    - **O preenchimento espelha `enterRunEditMode` na MESMA ordem**, porque `buildSplitFields()` monta as linhas a partir da distância: `r-km` primeiro, depois `buildSplitFields()`, depois `setRunSplits`/`setRunBpms`. E **preenche o formulário em vez de salvar** — ele confere e toca em Salvar, pelo caminho de sempre. A entrada manual fica intacta.
    - **FONTES, escolhidas por medição** (validado contra a corrida de 28/10: **9 de 10 campos idênticos** ao que ele digitou; o décimo erra 1s num km, por arredondamento de metros de borda):

      | Campo | Fonte |
      |---|---|
      | `splits` | `splits_metric[].moving_time / (distance/1000)` |
      | `splitBpm` | `splits_metric[].average_heartrate` — **existe** (o exemplo da doc só não tinha FC) |
      | `z1`…`z5` | `GET /activities/{id}/zones` — as faixas dele no Strava são idênticas às `userZones` |
      | `total` | soma das zonas (é como o modal deriva o campo) |
      | `avgPace` | `avgPaceFromSplits()`, a função do próprio app, para não divergir |

    - ⛔ **Calcular as parciais pelos streams NÃO funciona** e foi descartado: o stream `time` é tempo **decorrido**; mesmo descontando o stream `moving`, sobram ~25s de divergência no total. Tentado, medido, abandonado.
    - **Dois bugs pegos no teste:** arredondar segundos depois de separar o minuto gerava `"5:60"` — **o mesmo bug que o app já corrigira no `formatPace`** (invariante 28), repetido; e parciais residuais de ~0m geravam `NaN` no `avgPace` (agora filtradas por `distance >= 20`).
    - **Trava:** se as faixas do Strava divergirem das `userZones`, a conversão **avisa** em vez de gravar torto.
    - Scripts de apoio ficam fora do repositório, em `firebase-zes/`: `strava-token.js`, `strava-importar.js`, `strava-comparar-tudo.js`. O `strava.json` está no `.gitignore`.

37. **Rótulos de zona dos modais saem de `userZones`, nunca escritos à mão** (28/10/2026) — os modais de corrida e pedal traziam `Z1 (<131bpm)`, `Z2 (132-143bpm)`… **fixos no HTML, e esses números nunca bateram com `userZones`** — nem antes nem depois da correção da FCmáx. Viraram `<span class="z-faixa" data-z="z1">` preenchidos por `atualizarRotulosZona()`, chamada ao abrir cada modal.
    - ⚠️ `BPM_ZONES` (a constante com os mesmos valores) **continua existindo de propósito**: é o *fallback* de `getBpmRange()` para quando não há `userZones` — o que acontece em localhost sem login. Ver aquele `132-143` na tela ali **não é bug**; com dados reais o plano renderiza `Corrida Z2 (153-165bpm)`.

35. **FCmáx corrigida de 184 para 191 — e o teto do fácil subiu de 159 para 165** (28/10/2026) — medido no Strava, no TT de 5km de 08/09: **412s acima de 185 bpm, 93s acima de 189, 48s acima de 190, pico 191**. Não é pico de sensor, é esforço sustentado. **Máxima observada é um PISO, não estimativa** — não dá para ultrapassar a própria máxima.
    - `userZones` regravado com a **fórmula do próprio app** (`computeZones`), e os 191 foram para o campo `fc2` (o teste de 2km em esforço máximo, que é justamente o TT) — senão a tela de zonas recalcularia 184 de volta, já que `fcmax = max(fc1, fc2)`.
    - **Zonas novas:** Z1 ≤152 · Z2 153–165 · Z3 166–177 · Z4 178–184 · Z5 185–191.
    - **O teto do fácil era 159 porque é o TOPO DA Z2** (86,4% da máxima nos dois casos). Virou **165**. Constante renomeada de `TETO159` para `TETO_FACIL`, para o nome não amarrar a um número — 68 linhas atualizadas.
    - **Os 175 do ritmo de prova NÃO mudaram**, de propósito: aquele número nunca foi borda de zona, era julgamento. Com 184 valia **95,1%** da máxima (alto demais para limiar); com 191 vale **91,6%**, que é onde um teto de trabalho de limiar deve estar. Estava acidentalmente certo.
    - **O bloco de Munique (v4) mantém o 159**: era o que valia na época, e o plano é retroativo.
    - ⚠️ **Isso resolve o enigma aberto desde a prova** (invariante 28 e a análise de 11/10): os 177–181 sustentados por 40min eram 98% de 184 (improvável) e são **95% de 191** (normal para 10km). As duas hipóteses da época estavam certas em trechos diferentes da mesma corrida: no início **o sensor travou** (FC exatamente 139 por 12 minutos seguidos no stream — artefato, não medição) e do km 4 em diante o dado é bom, só a régua estava errada.
    - ⛔ **Por isso os bpm faltantes da prova NÃO foram preenchidos** com o dado do Strava, embora ele traga números ali: são o mesmo artefato. O `null` é a representação honesta. **Lição: conferir o stream por segundo antes de confiar num valor por km.**
    - ⚠️ `userZones` **não é LOG_KEY**, então a trava de encolhimento não a protege — um aparelho parado com o valor velho pode empurrar 184 de volta. Depois de mexer, abrir o app em todos os aparelhos.

34. **Exercício de reabilitação leva a EXECUÇÃO junto, não só o nome** (28/10/2026) — em 27/10 ele foi à academia e **pulou os circuitos porque não sabia fazer os exercícios**; o plano trazia só `Eversão de tornozelo com elástico 3x15 cada pé`. Cada exercício não-óbvio de `REAB_A`/`REAB_B` ganhou uma **linha de nota (prefixo `·`, invariante 27)** com a execução, incluindo o *porquê* quando ele muda o resultado (joelho dobrado = sóleo; glúteo médio fraco joga carga na lateral).
    - **A linha de nota não vira chave de carga** — confirmado por harness: `panturrilha em pé`, `panturrilha sentado`, `cadeira flexora` e `cadeira extensora` mantiveram a chave exata do `weightLog` e nenhuma nota virou exercício.
    - Incluída a **alternativa sem elástico** (isométrico contra a perna de uma cadeira), porque equipamento ausente é o outro motivo comum de pular.
    - **Regra geral:** prescrição que ele nunca fez antes vai com execução. Nome de exercício só basta quando ele já faz há meses.

33. **Guarda de login — a leitura também protege, não só a gravação** (27/10/2026) — a invariante 29 trancou o caminho de PUSH, mas o estrago real mora no PULL: `applyCloudData` escrevia a nuvem por cima do `localStorage` e apagava, em silêncio, lançamentos que ainda não tinham subido. Foi o que aconteceu com as cargas da academia de 27/10.
    - **`compararComNuvem(d)`** reusa `countRecords`/`LOG_KEYS` e devolve `{frente, atras}`: `frente` são as chaves em que o aparelho tem MAIS registros que a nuvem (o que se perderia ao aplicar), `atras` o contrário.
    - **Só interrompe quando há `frente`.** Sem risco, `loadFromCloud` aplica como sempre — aviso que aparece em todo login deixa de ser lido em duas semanas, e aí não protege mais nada. Essa foi a diferença entre a proposta original dele (confirmar a data do último sync em todo login) e o que ficou: **a data sozinha teria passado em 27/10**, porque o `lastSync` da nuvem era daquele mesmo dia — só que gravado pelo computador, não pelo celular. Data responde "quando alguém gravou"; o que importa é "o que eu vou perder".
    - **Envio PARCIAL resolve o conflito dos dois lados:** `syncToCloud(force, somenteChaves)` e `applyCloudData(d, somenteChaves)` ganharam filtro de chaves. Quando o aparelho está à frente numas e atrás noutras, o app **envia só as que não estão atrasadas** (como o `setDoc` usa `merge:true`, chave omitida fica intacta na nuvem) e depois **traz da nuvem só as que faltam aqui**. Nenhum dos dois lados perde nada — é o efeito prático das camadas 2 e 3 no caminho que importa, sem o custo delas.
    - ⚠️ **O rótulo da invariante 29 estava errado e foi corrigido.** O diálogo dizia `OK = trazer os dados da nuvem para cá (seguro, recomendado)` — seguro para a NUVEM e destrutivo para o aparelho. Hoje diz `ATENÇÃO: apaga o que só existe neste aparelho`. **Lição: num diálogo de conflito, "seguro" precisa dizer seguro para QUEM.**
    - O status pós-login passou a mostrar a data da nuvem (`Sincronizado ✓ · nuvem de 27/10 14:49`) — a ideia dele de ver a data, como informação sem atrito em vez de caixa de confirmação.

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
