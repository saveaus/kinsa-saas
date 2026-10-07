"use client"

import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { restartCourseAction } from "@/modules/training/actions"

export function RestartCourse({ enrolmentId }: { enrolmentId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        Restart
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restart this course?</AlertDialogTitle>
          <AlertDialogDescription>
            Progress and the exam result are cleared. You start again from the
            beginning.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
          <ActionForm
            action={restartCourseAction.bind(null, enrolmentId)}
            submitLabel="Restart"
            pendingLabel="Restarting..."
            submitVariant="destructive"
            submitSize="sm"
            bare
            className="w-fit"
            onSuccess={() => {
              setOpen(false)
              for (const key of Object.keys(localStorage)) {
                if (key.startsWith(`kinsa-exam:${enrolmentId}:`)) {
                  localStorage.removeItem(key)
                }
              }
            }}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
