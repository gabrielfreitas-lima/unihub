# Como adicionar um hub (fabricante)

Cada fabricante é um plugin em `src/renderer/plugins/<fabricante>/` e vira
uma aba. Os plugins não se conhecem entre si.

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

`protocol.js`: funções que montam e interpretam bytes, sem tocar em hardware.
Teste com `npm test` usando bytes reais (veja `test/gamesir-protocol.test.js`).

## 4. Crie a sessão

`session.js`: abre o `HIDDevice`, escuta `inputreport` e envia comandos pela
`CommandQueue` (um por vez, com confirmação e reenvio).

## 5. Crie o plugin

`plugin.js` exporta:

```js
export default {
  id: 'meufabricante',            // único
  name: 'Meu Fabricante',         // título da aba
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

### Gamepads

Controles de jogo não ganham aba própria: todos aparecem na aba **Gamepads**
(`plugins/gamepads/plugin.js`). Para dar opções extras a uma marca de
controle, faça como a GameSir: escreva o protocolo, a sessão e as sub-abas em
`plugins/<marca>/` e ligue no plugin Gamepads para os modelos conhecidos.

### Headsets

Fones e headsets também não ganham aba por marca: todos aparecem na aba
**Headsets** (`plugins/headsets/plugin.js`). Fones de qualquer marca são
achados pela interface HID de telefonia (`0x0B`) e pela lista de som do
sistema (que mostra também os Bluetooth), em `plugins/headsets/detect.js`, e
aparecem só com as informações do aparelho. Para dar opções extras a uma
marca, faça como a MCHOSE: protocolo e sessão em `plugins/<marca>/` e ligue
na aba Headsets para os modelos conhecidos.

### Teclados

Teclados também ficam numa aba só, **Teclados** (`plugins/keyboards/plugin.js`).
O aparelho é achado pela interface HID de teclado (página `0x01`, uso `0x06`),
agrupada por VID:PID em `plugins/keyboards/detect.js`. Controles e receptores de
mouse também têm essa interface, por isso ficam de fora: controle sempre, e
aparelho com interface de mouse só entra se o nome disser que é teclado.
O WebHID não mostra o teclado do notebook (PS/2 ou interno) e não diz se um
teclado é Bluetooth: o processo principal lista os teclados do Windows
(`system-keyboards`), e `systemKeyboards()` em `detect.js` marca os Bluetooth e
acrescenta o do notebook e os Bluetooth fora do WebHID. Teclado USB vem só do
WebHID. O
Chromium não deixa ler as teclas pelo WebHID: o teste de teclas usa os eventos
de teclado da página. Opções de uma marca (luzes, macros) entram como na GameSir
e na MCHOSE: protocolo e sessão em `plugins/<marca>/`, ligados na aba Teclados.

A aba **Luzes** que existe hoje é **só da AULA série F** (`plugins/aula/`): os
comandos, a lista de efeitos e as posições dos bytes são da AULA e não servem
para outras marcas. Para dar luzes a outra marca, escreva o protocolo dela em
`plugins/<marca>/` e mostre a aba só para os teclados dessa marca, como o
plugin Teclados faz com `brand === 'aula'`.

## 6. Registre

Importe o plugin em `src/renderer/plugins/index.js`.

O plugin aparece na janela **Plugins** (Configurações › "Adicionar plugin").
Ele só vira uma aba no cabeçalho depois que o usuário clica em "Adicionar".
Plugins com `status: 'planned'` aparecem como "Em breve" e não podem ser
adicionados (hoje não há nenhum: o app é organizado por tipo de aparelho, não
por marca); os com `status: 'tool'` ficam na seção "Avançado".

## Dicas

- Use sub-abas (`subTabs` em `core/dom.js`) por subsistema: botões, sticks,
  gatilhos, iluminação, DPI… e esconda as que o modelo não tem.
- Padrão de todas as abas: a sub-aba **Dispositivo** (informações do aparelho)
  vem sempre primeiro; as opções vêm depois.
- Libere gravação só depois de ter backup/restauração funcionando e testada.
- Nunca grave firmware sem validar modelo e CRC.
