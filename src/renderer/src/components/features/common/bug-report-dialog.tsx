import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea
} from '@/components/ui/input-group'
import { toast } from '@/components/ui/sonner'

interface BugReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const { t } = useTranslation()

  const formSchema = z.object({
    title: z
      .string()
      .min(5, t('bug_report.validation.title_min'))
      .max(64, t('bug_report.validation.title_max')),
    description: z
      .string()
      .min(20, t('bug_report.validation.desc_min'))
      .max(500, t('bug_report.validation.desc_max'))
  })
  const form = useForm({
    defaultValues: {
      title: '',
      description: ''
    },
    validators: {
      onSubmit: formSchema
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await window.api.bugReport.submit(value.title, value.description)

        if (result.success) {
          toast.success(t('bug_report.submit_success'), {
            description: t('bug_report.submit_success_desc')
          })

          form.reset()
          onOpenChange(false)
        } else {
          toast.error(t('bug_report.submit_failed'), {
            description: result.error || t('bug_report.submit_failed_desc')
          })
        }
      } catch (error: any) {
        console.error('Failed to submit bug report:', error)
        toast.error(t('bug_report.submit_failed'), {
          description: error.message || t('errors.unknown_error')
        })
      }
    }
  })

  const handleClose = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('bug_report.title')}</DialogTitle>
          <DialogDescription>{t('bug_report.description')}</DialogDescription>
        </DialogHeader>

        <form
          id="bug-report-form"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="title"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t('bug_report.issue_title')}</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t('bug_report.title_placeholder')}
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
            <form.Field
              name="description"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t('bug_report.issue_description')}
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupTextarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t('bug_report.description_placeholder')}
                        rows={6}
                        className="min-h-24 resize-none"
                        aria-invalid={isInvalid}
                      />
                      <InputGroupAddon align="block-end">
                        <InputGroupText className="tabular-nums">
                          {field.state.value.length}/500
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>{t('bug_report.description_placeholder')}</FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            {t('common.reset')}
          </Button>
          <Button type="submit" form="bug-report-form">
            {t('bug_report.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
