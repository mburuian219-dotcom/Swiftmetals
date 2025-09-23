"use client";

import { Phone, MessageCircle, User } from "lucide-react";
import Link from "next/link";

const contacts = [
  {
    role: "CEO",
    name: "Chief Executive Officer",
    phone: "0720205883",
    whatsapp: "https://wa.me/254720205883",
  },
  {
    role: "Manager",
    name: "Sales & Operations Manager",
    phone: "0115731499",
    whatsapp: "https://wa.me/254115731499",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-blue-50 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">Contact Us</h1>
          <p className="text-slate-600 text-lg">
            Reach out to our leadership team directly via phone or WhatsApp.
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {contacts.map((contact) => (
            <div
              key={contact.role}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all p-8 border border-slate-100 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800">
                {contact.role}
              </h3>
              <p className="text-slate-600 mb-4">{contact.name}</p>
              <div className="space-y-3 w-full">
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center justify-center gap-2 bg-emerald-500 text-white py-3 rounded-xl hover:bg-emerald-600 transition-all w-full"
                >
                  <Phone className="w-5 h-5" />
                  {contact.phone}
                </a>
                <Link
                  href={contact.whatsapp}
                  target="_blank"
                  className="flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-xl hover:bg-green-600 transition-all w-full"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp Chat
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-12 text-center text-slate-600 text-sm">
          <p>Available during business hours (Mon - Sat, 9am - 6pm).</p>
        </div>
      </div>
    </div>
  );
}
