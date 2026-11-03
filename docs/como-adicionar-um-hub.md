# Como adicionar um hub (fabricante)

O código é dividido em duas partes:

- **`src/renderer/plugins/<tipo>/<marca>/`: o plugin da marca.** É o backend:
  tudo o que se sabe sobre os aparelhos daquela marca (protocolo, sessão, nomes,
  modelos), sem nada de tela. Exemplos: `plugins/gamepads/gamesir/`,
  `plugins/teclados/aula/`.
- **`src/renderer/frontend/<tipo>/`: a aba do tipo de aparelho.** É a tela. As
  sub-abas de uma marca ficam em `frontend/<tipo>/<marca>/`.

O app é organizado por tipo de aparelho: cada tipo é uma aba, e a marca entra
dentro dela. Um plugin não importa a tela nem o plugin de outra marca
(`test/arquitetura.test.js` confere isso).

## 1. Descubra o dispositivo

Abra a aba **Dispositivos HID**. Anote:

- VID:PID (muda entre modo com fio, sem fio e dongle);
- a coleção com **Usage Page do fabricante** (`0xFF00`–`0xFFFF`): normalmente é a de configuração;
- os IDs dos relatórios de entrada, saída e feature dessa coleção.

## 2. Documente o protocolo

Crie `docs/protocolos/<fabricante>.md` com os bytes de cada comando e marque
o que já foi confirmado com hardware.
Comece pelos comandos de leitura (versão, bateria) e só depois pelos de gravação.

## 3. Escreva o protocolo como funções puras

`plugins/<tipo>/<marca>/protocol.js`: funções que montam e interpretam bytes,
sem tocar em hardware. Teste com `npm test` usando bytes reais (veja
`test/gamesir-protocol.test.js`).

## 4. Crie a sessão

`plugins/<tipo>/<marca>/session.js`: abre o `HIDDevice`, escuta `inputreport` e
envia comandos pela `CommandQueue` (um por vez, com confirmação e reenvio).

## 5. Ligue a marca na aba do tipo

Se o tipo de aparelho já existe, mostre as opções da marca na aba dele:

### Gamepads

Todos os controles aparecem na aba **Gamepads** (`frontend/gamepads/tab.js`).
Para dar opções extras a uma marca, faça como a GameSir: protocolo e sessão em
`plugins/gamepads/gamesir/`, sub-abas em `frontend/gamepads/gamesir/`, ligadas na
aba para os modelos conhecidos.

### Headsets

Todos os fones aparecem na aba **Headsets** (`frontend/headsets/tab.js`). Fones
de qualquer marca são achados pela interface HID de telefonia (`0x0B`) e pela
lista de som do sistema (que mostra também os Bluetooth), em
`plugins/headsets/detect.js`, e aparecem só com as informações do aparelho. Para
dar opções extras a uma marca, faça como a MCHOSE: protocolo e sessão em
`plugins/headsets/mchose/` e ligue na aba para os modelos conhecidos.

### Teclados

Todos os teclados aparecem na aba **Teclados** (`frontend/teclados/tab.js`).
O aparelho é achado pela interface HID de teclado (página `0x01`, uso `0x06`),
agrupada por VID:PID em `plugins/teclados/detect.js`. Controles e receptores de
mouse também têm essa interface, por isso ficam de fora: controle sempre, e
aparelho com interface de mouse só entra se o nome disser que é teclado.
O WebHID não mostra o teclado do notebook (PS/2 ou interno) e não diz se um
teclado é Bluetooth: o processo principal lista os teclados do Windows
(`system-keyboards`), e `systemKeyboards()` em `detect.js` marca os Bluetooth e
acrescenta o do notebook e os Bluetooth fora do WebHID. Teclado USB vem só do
WebHID. O Chromium não deixa ler as teclas pelo WebHID: o teste de teclas usa os
eventos de teclado da página.

A aba **Luzes** que existe hoje é **só da AULA série F**
(`plugins/teclados/aula/`, tela em `frontend/teclados/aula/`): os comandos, a
lista de efeitos e as posições dos bytes são da AULA e não servem para outras
marcas. Para dar luzes a outra marca, crie `plugins/teclados/<marca>/` e mostre
a aba só para os teclados dessa marca, como a aba Teclados faz com
`brand === 'aula'`.

## 6. Tipo de aparelho novo

Só se o tipo ainda não existe: crie `frontend/<tipo>/tab.js`, que exporta:

```js
export default {
  id: 'meutipo',                  // único
  name: 'Meu Tipo',               // título da aba
  icon: () => svgElement,         // opcional: ícone na barra lateral (senão, a 1ª letra do nome)
  tagline: 'Descrição curta',
  status: 'beta',                 // 'beta' | 'planned' | 'tool'
  filters: [{ vendorId: 0x1234 }],// usados pelo botão "Procurar dispositivos"
  matches(device) { return device.vendorId === 0x1234; },
  summary(devices) { return devices.map((d) => d.productName); }, // opcional: nomes no Início
  mount(container, ctx) {
    // desenhe a aba dentro de `container`
    return {
      update(devices) { /* chamado quando dispositivos entram ou saem */ },
      // opcional: aparelhos conectados, um cartão cada no Início
      cards() { return [{ id, name, connection, battery: { percent, charging }, status }]; },
      // opcional: abre o aparelho `id` (clique no cartão do Início)
      focus(id) {},
      unmount() { /* feche as sessões */ },
    };
  },
};
```

`ctx` tem `ctx.hid` (gerenciador HID) e `ctx.toast(mensagem, 'error'|'info')`.

Importe a aba em `src/renderer/frontend/index.js`.

Ela aparece na janela **Abas** (Configurações › "Adicionar aba") e só vira
uma aba no menu depois que o usuário clica em "Adicionar". Com `status: 'planned'`
aparece como "Em breve" e não pode ser adicionada (hoje não há nenhuma); com
`status: 'tool'` fica na seção "Avançado".

## Dicas

- Use sub-abas (`subTabs` em `core/dom.js`) por subsistema: botões, sticks,
  gatilhos, iluminação, DPI… e esconda as que o modelo não tem.
- Padrão de todas as abas: a sub-aba **Dispositivo** (informações do aparelho)
  vem sempre primeiro; as opções vêm depois.
- Libere gravação só depois de ter backup/restauração funcionando e testada.
- Nunca grave firmware sem validar modelo e CRC.
