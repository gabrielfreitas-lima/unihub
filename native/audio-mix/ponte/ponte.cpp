// Ponte entre o UniHub e o efeito de áudio do microfone.
//
// O app (Electron) não acessa memória compartilhada do Windows; ele abre este
// programa e manda o som pela entrada padrão: amostras float de 32 bits, mono,
// 48000 Hz, já no volume certo. A ponte escreve no canal no ritmo do relógio.
//
// Uso: ponte.exe            (lê o som da entrada padrão e envia)
//      ponte.exe --estado   (sai com 0 se há efeito com o canal aberto)
// Saída: 0 enviado, 3 canal não encontrado (nenhum app usando o microfone com
// o efeito), 4 canal com formato inesperado.

#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <io.h>
#include <fcntl.h>
#include <vector>
#include "../comum/canal.h"

// Sem canal, ainda lê (e descarta) o som que o app está mandando: sair com a
// entrada aberta faria a escrita do app falhar.
static int Falhar(bool estado, const char* erro, int codigo) {
  if (!estado) {
    _setmode(_fileno(stdin), _O_BINARY);
    char lixo[65536];
    while (fread(lixo, 1, sizeof(lixo), stdin) > 0) {}
  }
  fprintf(stdout, "{\"ok\":false,\"erro\":\"%s\"}\n", erro);
  return codigo;
}

int wmain(int argc, wchar_t** argv) {
  const bool estado = argc > 1 && !wcscmp(argv[1], L"--estado");
  HANDLE mapa = OpenFileMappingW(FILE_MAP_READ | FILE_MAP_WRITE, FALSE, CANAL_NOME);
  if (!mapa) return Falhar(estado, "canal", 3);
  Canal* canal = static_cast<Canal*>(MapViewOfFile(mapa, FILE_MAP_READ | FILE_MAP_WRITE, 0, 0, sizeof(Canal)));
  if (!canal || canal->magico != CANAL_MAGICO || canal->versao != CANAL_VERSAO) return Falhar(estado, "formato", 4);
  if (estado) {
    fprintf(stdout, "{\"ok\":true,\"leitores\":%d}\n", canal->leitores);
    return 0;
  }

  // Lê todo o som antes de começar: o app manda de uma vez, e o ritmo fica por conta daqui.
  _setmode(_fileno(stdin), _O_BINARY);
  std::vector<float> som;
  float bloco[4096];
  size_t n;
  while ((n = fread(bloco, sizeof(float), 4096, stdin)) > 0) som.insert(som.end(), bloco, bloco + n);

  // Escreve no ritmo do relógio, com até 200 ms de folga, para não passar quem lê.
  const int64_t folga = CANAL_TAXA / 5;
  LARGE_INTEGER freq, inicio, agora;
  QueryPerformanceFrequency(&freq);
  QueryPerformanceCounter(&inicio);
  size_t enviado = 0;
  while (enviado < som.size()) {
    QueryPerformanceCounter(&agora);
    const int64_t limite = (agora.QuadPart - inicio.QuadPart) * CANAL_TAXA / freq.QuadPart + folga;
    while (enviado < som.size() && static_cast<int64_t>(enviado) < limite) {
      const int64_t pos = canal->escritos;
      canal->dados[pos % canal->quadros] = som[enviado++];
      MemoryBarrier();
      InterlockedExchange64(&canal->escritos, pos + 1);
    }
    Sleep(10);
  }
  fprintf(stdout, "{\"ok\":true,\"leitores\":%d,\"amostras\":%zu}\n", canal->leitores, som.size());
  UnmapViewOfFile(canal);
  CloseHandle(mapa);
  return 0;
}
