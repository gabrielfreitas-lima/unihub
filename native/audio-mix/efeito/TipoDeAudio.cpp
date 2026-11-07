// Implementação mínima de CreateAudioMediaTypeFromUncompressedAudioFormat.
//
// A classe base de APOs do SDK usa essa função para sugerir um formato ao
// Windows. A versão do SDK (audiomediatypecrt.lib) depende da ATL, que não vem
// no Build Tools; esta faz o mesmo para o formato não comprimido (PCM/float).

#include <windows.h>
#include <mmreg.h>
#include <ks.h>
#include <ksmedia.h>
#include <new>
#include <audiomediatype.h>

class TipoDeAudio final : public IAudioMediaType {
public:
  explicit TipoDeAudio(const UNCOMPRESSEDAUDIOFORMAT& f) : m_formato(f) {
    WAVEFORMATEXTENSIBLE& w = m_wave;
    ZeroMemory(&w, sizeof(w));
    w.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
    w.Format.nChannels = static_cast<WORD>(f.dwSamplesPerFrame);
    w.Format.nSamplesPerSec = static_cast<DWORD>(f.fFramesPerSecond);
    w.Format.wBitsPerSample = static_cast<WORD>(f.dwBytesPerSampleContainer * 8);
    w.Format.nBlockAlign = static_cast<WORD>(f.dwSamplesPerFrame * f.dwBytesPerSampleContainer);
    w.Format.nAvgBytesPerSec = w.Format.nSamplesPerSec * w.Format.nBlockAlign;
    w.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
    w.Samples.wValidBitsPerSample = static_cast<WORD>(f.dwValidBitsPerSample);
    w.dwChannelMask = 0;
    w.SubFormat = f.guidFormatType;
  }

  STDMETHODIMP QueryInterface(REFIID iid, void** ppv) override {
    if (!ppv) return E_POINTER;
    if (iid == __uuidof(IUnknown) || iid == __uuidof(IAudioMediaType)) { *ppv = this; AddRef(); return S_OK; }
    *ppv = nullptr;
    return E_NOINTERFACE;
  }
  STDMETHODIMP_(ULONG) AddRef() override { return InterlockedIncrement(&m_refs); }
  STDMETHODIMP_(ULONG) Release() override {
    ULONG n = InterlockedDecrement(&m_refs);
    if (n == 0) delete this;
    return n;
  }

  STDMETHODIMP IsCompressedFormat(BOOL* comprimido) override {
    if (!comprimido) return E_POINTER;
    *comprimido = FALSE;
    return S_OK;
  }

  STDMETHODIMP IsEqual(IAudioMediaType* outro, DWORD* flags) override {
    if (!outro || !flags) return E_POINTER;
    UNCOMPRESSEDAUDIOFORMAT f = {};
    *flags = 0;
    if (FAILED(outro->GetUncompressedAudioFormat(&f))) return S_FALSE;
    if (f.guidFormatType == m_formato.guidFormatType) *flags |= AUDIOMEDIATYPE_EQUAL_FORMAT_TYPES;
    if (f.guidFormatType == m_formato.guidFormatType && f.dwSamplesPerFrame == m_formato.dwSamplesPerFrame &&
        f.dwBytesPerSampleContainer == m_formato.dwBytesPerSampleContainer &&
        f.dwValidBitsPerSample == m_formato.dwValidBitsPerSample && f.fFramesPerSecond == m_formato.fFramesPerSecond)
      *flags |= AUDIOMEDIATYPE_EQUAL_FORMAT_DATA | AUDIOMEDIATYPE_EQUAL_FORMAT_USER_DATA;
    return (*flags & AUDIOMEDIATYPE_EQUAL_FORMAT_DATA) ? S_OK : S_FALSE;
  }

  STDMETHODIMP_(const WAVEFORMATEX*) GetAudioFormat() override { return &m_wave.Format; }

  STDMETHODIMP GetUncompressedAudioFormat(UNCOMPRESSEDAUDIOFORMAT* f) override {
    if (!f) return E_POINTER;
    *f = m_formato;
    return S_OK;
  }

private:
  volatile LONG m_refs = 1;
  UNCOMPRESSEDAUDIOFORMAT m_formato;
  WAVEFORMATEXTENSIBLE m_wave;
};

STDAPI CreateAudioMediaTypeFromUncompressedAudioFormat(const UNCOMPRESSEDAUDIOFORMAT* f, IAudioMediaType** tipo) {
  if (!f || !tipo) return E_POINTER;
  *tipo = new (std::nothrow) TipoDeAudio(*f);
  return *tipo ? S_OK : E_OUTOFMEMORY;
}
