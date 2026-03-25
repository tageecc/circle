import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react'
import { Button } from '../ui/button'

interface ImagePreviewProps {
  path: string
  className?: string
}

export function ImagePreview({ path, className }: ImagePreviewProps) {
  const { t } = useTranslation('editor')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [imageInfo, setImageInfo] = useState<{
    width: number
    height: number
    size: string
  } | null>(null)

  useEffect(() => {
    let mounted = true
    let blobUrl: string | null = null

    const loadImage = async () => {
      try {
        const ext = path.split('.').pop()?.toLowerCase()

        // 获取文件信息
        const stats = await window.api.files.stat?.(path)
        const fileSize = stats?.size || 0
        const fileSizeStr = formatFileSize(fileSize)

        // 根据文件扩展名设置正确的 MIME 类型
        const mimeTypes: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          svg: 'image/svg+xml',
          webp: 'image/webp',
          bmp: 'image/bmp',
          ico: 'image/x-icon'
        }

        const mimeType = mimeTypes[ext || ''] || 'image/png'
        let url = ''

        // 如果是 SVG，使用文本读取
        if (ext === 'svg') {
          const content = await window.api.files.read(path)
          const blob = new Blob([content], { type: 'image/svg+xml' })
          url = URL.createObjectURL(blob)
          blobUrl = url
        } else {
          // 其他图片格式，使用二进制读取
          const buffer = await window.api.files.readBinary(path)
          // 将 Uint8Array 转换为 base64
          let binary = ''
          const len = buffer.byteLength
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(buffer[i])
          }
          const base64 = btoa(binary)
          url = `data:${mimeType};base64,${base64}`
        }

        if (!mounted) return
        setImageUrl(url)

        // 加载图片获取尺寸
        const img = new Image()
        img.onload = () => {
          if (mounted) {
            setImageInfo({
              width: img.naturalWidth,
              height: img.naturalHeight,
              size: fileSizeStr
            })
          }
        }
        img.src = url
      } catch (error) {
        console.error('Failed to load image:', error)
      }
    }

    loadImage()

    return () => {
      mounted = false
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [path])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 400))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 25))
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleReset = () => {
    setZoom(100)
    setRotation(0)
  }

  return (
    <div className={cn('flex h-full w-full flex-col bg-background', className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {imageInfo && (
            <>
              <span>
                {imageInfo.width} × {imageInfo.height}
              </span>
              <span>{imageInfo.size}</span>
              <span>{zoom}%</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleZoomOut}
            disabled={zoom <= 25}
            title={t('imagePreview.zoomOut')}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleZoomIn}
            disabled={zoom >= 400}
            title={t('imagePreview.zoomIn')}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleRotate}
            title={t('imagePreview.rotate')}
          >
            <RotateCw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleReset}
            title={t('imagePreview.reset')}
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* 图片预览区域 */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {imageUrl ? (
          <div
            className="transition-transform duration-200"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`
            }}
          >
            <img
              src={imageUrl}
              alt={t('imagePreview.alt')}
              className="max-h-full max-w-full select-none shadow-lg"
              draggable={false}
              style={{
                imageRendering: zoom > 100 ? 'pixelated' : 'auto'
              }}
            />
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <p className="text-sm">{t('imagePreview.loading')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
