import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

export default function Assets() {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0])
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier')
      return
    }

    setUploading(true)
    try {
      const fileContent = await selectedFile.text()
      const response = await api.put(`/assets/${selectedFile.name}`, fileContent, {
        headers: {
          'Content-Type': selectedFile.type || 'text/plain'
        }
      })

      if (response.ok) {
        toast.success('Fichier uploadé avec succès')
        setFiles(prev => [...prev, { 
          name: selectedFile.name, 
          size: selectedFile.size,
          type: selectedFile.type,
          uploadedAt: new Date().toISOString()
        }])
        setSelectedFile(null)
        document.getElementById('file-input').value = ''
      } else {
        toast.error('Erreur lors de l\'upload')
      }
    } catch (error) {
      toast.error('Erreur de connexion')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (filename) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}/assets/${filename}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Téléchargement démarré')
      } else {
        toast.error('Fichier non trouvé')
      }
    } catch (error) {
      toast.error('Erreur de téléchargement')
    }
  }

  const copyCurlUpload = (filename) => {
    const curl = `curl -X PUT "${process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}/assets/${filename}" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: text/plain" \\
  --data "Your file content here"`
    
    navigator.clipboard.writeText(curl)
    toast.success('Commande cURL copiée')
  }

  const copyCurlDownload = (filename) => {
    const curl = `curl "${process.env.NEXT_PUBLIC_API_BASE || 'https://api.alphogen.com'}/assets/${filename}" -o "${filename}"`
    
    navigator.clipboard.writeText(curl)
    toast.success('Commande cURL copiée')
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Assets</h1>
          
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload de fichier</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Sélectionner un fichier
                </label>
                <input
                  id="file-input"
                  type="file"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              {selectedFile && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600">
                    <strong>Fichier sélectionné:</strong> {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </p>
                </div>
              )}
              
              <div className="flex space-x-4">
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium"
                >
                  {uploading ? 'Upload en cours...' : 'Uploader'}
                </button>
                
                {selectedFile && (
                  <button
                    onClick={() => copyCurlUpload(selectedFile.name)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md text-sm font-medium"
                  >
                    Copier cURL
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Fichiers uploadés</h2>
            
            {files.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun fichier uploadé pour le moment</p>
            ) : (
              <div className="space-y-4">
                {files.map((file, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{file.name}</h3>
                        <p className="text-sm text-gray-500">
                          {Math.round(file.size / 1024)} KB • {file.type || 'text/plain'} • 
                          Uploadé le {new Date(file.uploadedAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDownload(file.name)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                          Télécharger
                        </button>
                        <button
                          onClick={() => copyCurlDownload(file.name)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                          cURL
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Exemples cURL</h3>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Upload:</strong>
                <code className="block bg-white p-2 rounded mt-1 text-xs">
                  curl -X PUT "https://api.alphogen.com/assets/example.txt" -H "Authorization: Bearer YOUR_TOKEN" --data "Hello World"
                </code>
              </div>
              <div>
                <strong>Download:</strong>
                <code className="block bg-white p-2 rounded mt-1 text-xs">
                  curl "https://api.alphogen.com/assets/example.txt" -o "example.txt"
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
