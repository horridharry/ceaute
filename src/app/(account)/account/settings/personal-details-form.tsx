"use client"
import { useState } from "react";

type SettingFieldName = "name" | "email" | "phone";

type SettingFieldProps = {
  label: string;
  value: string;
  field: SettingFieldName;
  editing: boolean;
  onToggle: (field: SettingFieldName) => void;
  onSave: (field: SettingFieldName, value: string) => void;
};

type AccountSettingsFormProps = {
  name: string;
  email: string;
  phone: string;
};

function SettingField({
  label,
  value,
  field,
  editing,
  onToggle,
  onSave,
}: SettingFieldProps) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="grid">
      <div className="flex items-center justify-between">
        <label className="font-medium tracking-tight">{label}</label>
        <button className="font-medium tracking-tight hover:underline" onClick={() => onToggle(field)}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <>
          <input
            className="bg-black/6 rounded-xl p-2 font-medium w-80"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="mt-6 bg-black/90 rounded-full p-2 px-4 font-medium text-white justify-self-start"
            onClick={() => onSave(field, draft)}
          >
            Save
          </button>
        </>
      ) : (
        <p className="text-sm opacity-70">{value}</p>
      )}
    </div>
  );
}

export default function AccountSettingsForm({
  name,
  email,
  phone,
}: AccountSettingsFormProps) {
const [editing, setEditing] = useState({ name: false, email: false, phone: false });

const toggleEdit = (field: SettingFieldName) => {
  setEditing(prev => ({ ...prev, [field]: !prev[field] }));
};

const handleSave = () => {
  console.log('save')
}

  return (
    
          <div className="grid gap-6 mt-6">
            <SettingField label="Full name" value={name} field="name" editing={editing.name} onToggle={toggleEdit} onSave={handleSave} />
<SettingField label="Email address" value={email} field="email" editing={editing.email} onToggle={toggleEdit} onSave={handleSave} />
<SettingField label="Phone number (Optional)" value={phone} field="phone" editing={editing.phone} onToggle={toggleEdit} onSave={handleSave} />
          </div>
  );
}
