# UniHub

Um só app para configurar periféricos de vários fabricantes, no lugar de um "hub"
oficial de cada marca. Cada tipo de aparelho (controles, headsets, teclados…) é uma aba que
reconhece qualquer marca, com opções extras para as marcas cujo protocolo o
UniHub já conhece (GameSir, MCHOSE, Logitech…).


## Estado

| Aba | Estado | O que faz |
|---|---|---|
| Gamepads | beta | todos os controles de jogo conectados, com teste de botões visual e informações. **Controles GameSir** (testado com Cyclone 2) ganham também: **editor de luzes** (animações, predefinições, quadros-chave, cores, brilho, velocidade, áudio, despertar, suspensão, indicador de perfil), vibração com animação, **mapeamento de botões** por perfil, taxa de relatório, bateria com aviso, backup de perfis, firmware |
| Headsets | beta | fones e headsets de **qualquer marca**, pelo dongle, cabo USB ou Bluetooth: **Configurações de áudio** (teste de som esquerdo/direito, retorno do microfone, atalho para o som do Windows; funcionam no fone que é a saída de som padrão do Windows), informações do aparelho e, **por Bluetooth, a bateria** (lida do Windows, com aviso de bateria baixa). **Headsets Logitech** (HID++, **não testado com hardware**) ganham nome e bateria. **Headsets MCHOSE** (testado com V9 PRO) ganham também, pelo dongle, bateria com estado de carga e versão do firmware. Equalizador e surround ainda não (dependem do driver de áudio do fabricante) |
| Teclados | beta | teclados de **qualquer marca**, com fio, pelo dongle, por **Bluetooth** (com o nome do aparelho) e o **teclado do notebook** (PS/2 ou interno, pela lista do Windows; testados só com exemplos): informações do aparelho (fabricante pelo VID, VID:PID) e **teste de teclas** visual (teclado padrão no layout do sistema, ou o desenho do modelo nas marcas conhecidas; teclas testadas, quantas teclas juntas). O teste usa as teclas que o Windows recebe, de qualquer teclado. **Teclados AULA série F** (testado com F75) são reconhecidos no cabo e pelo dongle 2.4G, com o modelo escolhido pelo usuário, o desenho de cada modelo no teste (F75, F87 e F99), a aba **Luzes** (efeito, brilho, velocidade e 7 cores por efeito) e, pelo dongle, a **bateria** com aviso de bateria baixa. Macros e troca de teclas ainda não |
| Dispositivos HID | ferramenta | lista todas as interfaces HID, para começar um novo hub |

As abas só aparecem depois que você as ativa em **Configurações › Adicionar aba**
(engrenagem no menu).
Também em **Configurações**, dá para **iniciar o UniHub com o Windows**
e, com isso ligado, deixá-lo na **bandeja do sistema**: ele começa só com o ícone
perto do relógio, fechar a janela só a esconde, e os avisos de bateria continuam chegando.
O menu pode ficar **em cima** (padrão) ou **à esquerda**, como barra lateral; à esquerda,
o alfinete deixa o menu sempre aberto ou recolhido (só ícones, abre ao passar o mouse).
No primeiro uso, o Início dá as boas-vindas e mostra os aparelhos
encontrados, com o botão para ativar o suporte de cada marca.

Ainda **não** faz: atualização de firmware, turbo e macros.

## Como rodar

Requer Node.js 20 ou mais novo.

```bash
npm install
npm start
```

Testes do protocolo (não precisam de hardware):

```bash
npm test
```

Feche outros apps que usem o mesmo aparelho antes de usar a aba correspondente: dois
apps disputando o mesmo dispositivo HID causam falhas de leitura.

## Arquitetura

- **Electron**, sem módulos nativos e sem DLLs.
- O processo principal (`src/main/main.cjs`) só cria a janela e libera o
  acesso HID para a página local.
- A página (`src/renderer/`) usa APIs padrão:
  - **WebHID** para conversar com os dispositivos;
  - **Gamepad API** para o teste de botões.
- `core/hid-manager.js`: registro de dispositivos; trata conexão e desconexão.
- `core/command-queue.js`: fila por dispositivo, com confirmação e reenvio.
- `plugins/<tipo>/<marca>/`: o plugin da marca, só backend: `protocol.js` (bytes,
  testável), `session.js` (um dispositivo aberto) e o que se sabe dos modelos.
- `frontend/<tipo>/`: a tela, uma aba por tipo de aparelho.

Para adicionar um fabricante: [docs/como-adicionar-um-hub.md](docs/como-adicionar-um-hub.md).

## Limitações conhecidas

- Dois controles idênticos aparecem com o mesmo nome. Para saber qual é qual,
  aperte um botão no controle: a entrada dele pisca por 1,5 s na lista.
- O dongle GameSir e o controle ligado nele viram uma entrada só. A regra usa
  a tabela de PIDs conhecidos em `plugins/gamepads/gamesir/names.js`; modelos novos
  precisam ser cadastrados lá.
- O layout dos perfis GameSir muda entre modelos. O mapeamento de botões só
  aparece para modelos confirmados (hoje, o Cyclone 2).

## Licença

MIT. Veja [LICENSE](LICENSE). Marcas citadas pertencem aos respectivos donos;
este projeto não é afiliado a nenhum fabricante.
