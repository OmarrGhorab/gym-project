"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { MoreHorizontal, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createMember, deactivateMember, updateMember, uploadMemberPhoto } from "./actions";
import type { MemberRow } from "./data";
import { MemberDetailsDialog } from "./member-details-dialog";

type ActionResult = {
  label: string;
  run: (formData: FormData) => Promise<void>;
  success: string;
};

function useActionSubmit({ label, run, success }: ActionResult, close?: () => void) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await run(formData);
        toast.success(success);
        close?.();
        router.refresh();
      } catch (error) {
        toast.error(`${label} failed`, {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      }
    });
  }

  return { pending, submit };
}

export function AddMemberDialog() {
  const [open, setOpen] = React.useState(false);
  const { pending, submit } = useActionSubmit(
    { label: "Create member", run: createMember, success: "Member created." },
    () => setOpen(false),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus data-icon="inline-start" />
        Add Member
      </DialogTrigger>
      <MemberFormContent
        description="Create a backend member record. Subscriptions can be managed from Membership."
        pending={pending}
        submit={submit}
        submitLabel="Create member"
        title="Add member"
      />
    </Dialog>
  );
}

export function EditMemberDialog({ member }: { member: MemberRow }) {
  const [open, setOpen] = React.useState(false);
  const { pending, submit } = useActionSubmit(
    { label: "Update member", run: updateMember, success: "Member updated." },
    () => setOpen(false),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<DropdownMenuItem />}>Edit member</DialogTrigger>
      <MemberFormContent
        description="Update profile fields stored in the backend."
        member={member}
        pending={pending}
        submit={submit}
        submitLabel="Save changes"
        title="Edit member"
      />
    </Dialog>
  );
}

export function MemberPhotoDialog({ member }: { member: MemberRow }) {
  const [open, setOpen] = React.useState(false);
  const { pending, submit } = useActionSubmit(
    { label: "Upload photo", run: uploadMemberPhoto, success: "Member photo updated." },
    () => setOpen(false),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<DropdownMenuItem />}>Upload photo</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload photo</DialogTitle>
          <DialogDescription>Attach a profile photo for {member.name}.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <input type="hidden" name="member_id" value={member.id} />
          <Input name="photo" type="file" accept="image/*" required />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading..." : "Upload photo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MemberActionsMenu({
  details,
  member,
  visits,
}: {
  details: React.ReactNode;
  member: MemberRow;
  visits: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Actions for ${member.name}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          {details}
          <EditMemberDialog member={member} />
          <MemberPhotoDialog member={member} />
          {visits}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DeactivateMemberItem member={member} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MemberDetailsMenuItem(props: React.ComponentProps<typeof MemberDetailsDialog>) {
  return (
    <MemberDetailsDialog {...props} trigger={<DropdownMenuItem />}>
      View details
    </MemberDetailsDialog>
  );
}

function DeactivateMemberItem({ member }: { member: MemberRow }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <DropdownMenuItem
      variant="destructive"
      disabled={pending || member.status !== "active"}
      onClick={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("id", String(member.id));
        startTransition(async () => {
          try {
            await deactivateMember(formData);
            toast.success("Member deactivated.");
            router.refresh();
          } catch (error) {
            toast.error("Deactivate failed", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
          }
        });
      }}
    >
      Deactivate
    </DropdownMenuItem>
  );
}

function MemberFormContent({
  description,
  member,
  pending,
  submit,
  submitLabel,
  title,
}: {
  description: string;
  member?: MemberRow;
  pending: boolean;
  submit: (formData: FormData) => void;
  submitLabel: string;
  title: string;
}) {
  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        {member ? <input type="hidden" name="id" value={member.id} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" defaultValue={member?.name} required />
          <Field label="Phone" name="phone" defaultValue={member?.phone} required />
          <Field label="Email" name="email" type="email" defaultValue={member?.email ?? ""} />
          <div className="grid gap-2">
            <span className="font-medium text-sm">Gender</span>
            <Select name="gender" defaultValue={member?.gender ?? ""}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Field label="Join date" name="join_date" type="date" defaultValue={member?.join_date ?? ""} />
          <Field label="Birth date" name="birth_date" type="date" defaultValue={member?.birth_date ?? ""} />
          <Field label="National ID" name="national_id" defaultValue="" />
          <div className="grid gap-2">
            <span className="font-medium text-sm">Status</span>
            <Select name="status" defaultValue={member?.status ?? "active"}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <span className="font-medium text-sm">Notes</span>
          <Textarea name="notes" defaultValue={member?.notes ?? ""} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({
  defaultValue,
  label,
  name,
  required = false,
  type = "text",
}: {
  defaultValue?: string | null;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <span className="font-medium text-sm">{label}</span>
      <Input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}
