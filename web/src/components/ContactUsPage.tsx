import React, { useState } from 'react';
import {
  User,
  Mail,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../utils/api';

const ContactUsPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      window.alert('Missing Fields\nPlease fill in all fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user ID if logged in
      let userId = null;
      try {
        const user = getStoredUser();
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        // User not logged in, continue without userId
      }

      // Submit feedback to backend
      const response = await apiRequest<{ success: boolean; message?: string }>('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.success) {
        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          setFormData({ name: '', email: '', subject: '', message: '' });
        }, 3000);
      } else {
        window.alert(`Error\n${response.message || 'Failed to submit feedback. Please try again.'}`);
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      window.alert(
        `Error\n${error.message || 'Failed to submit feedback. Please try again.'}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      q: 'How do I join a tournament?',
      a: "Go to the Tournaments page, find a tournament, and tap 'Register Now'.",
    },
    {
      q: 'Can I borrow games from others?',
      a: 'Yes! Visit Game Borrowing to request available games from other users.',
    },
    {
      q: 'How do I create or join a community?',
      a: 'Go to Communities to browse or create your own group based on interests.',
    },
    {
      q: 'What are the system requirements?',
      a: 'GamerHive works smoothly on any modern device with internet access.',
    },
  ];

  if (isSubmitted) {
    return (
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="min-h-screen flex items-center justify-center px-6 py-20">
          <div className="text-center">
            <div className="w-[120px] h-[120px] bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-[60px] h-[60px] text-white" size={60} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">Feedback Submitted!</h1>
            <p className="text-purple-200 text-base">
              Thank you for contacting us. We'll respond within 24 hours.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <div className="min-h-screen">
        {/* Header */}
        <div className="px-5 py-5 bg-slate-800 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Contact Us</h1>
          <p className="text-purple-200 text-base">
            Have questions or feedback? Reach out to us anytime.
          </p>
        </div>

        {/* Contact Form */}
        <div className="bg-slate-800 m-4 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white mb-4">Send us a Message</h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <div className="flex items-center bg-slate-700 rounded-lg mb-3 px-3">
              <User className="w-5 h-5 text-purple-400 mr-2" />
              <input
                type="text"
                placeholder="Full Name"
                className="flex-1 bg-transparent text-white py-2.5 placeholder-gray-400 outline-none"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>

            {/* Email */}
            <div className="flex items-center bg-slate-700 rounded-lg mb-3 px-3">
              <Mail className="w-5 h-5 text-purple-400 mr-2" />
              <input
                type="email"
                placeholder="Email Address"
                className="flex-1 bg-transparent text-white py-2.5 placeholder-gray-400 outline-none"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>

            {/* Subject */}
            <div className="flex items-center bg-slate-700 rounded-lg mb-3 px-3">
              <MessageSquare className="w-5 h-5 text-purple-400 mr-2" />
              <input
                type="text"
                placeholder="Subject"
                className="flex-1 bg-transparent text-white py-2.5 placeholder-gray-400 outline-none"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
              />
            </div>

            {/* Message */}
            <div className="flex items-start bg-slate-700 rounded-lg mb-3 px-3 pt-3">
              <MessageSquare className="w-5 h-5 text-purple-400 mr-2 mt-2" />
              <textarea
                placeholder="Your Message"
                rows={6}
                className="flex-1 bg-transparent text-white py-2.5 placeholder-gray-400 outline-none resize-none"
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center justify-center w-full bg-purple-600 py-3.5 rounded-xl mt-2.5 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
              } transition-colors`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="text-white font-semibold mr-2">Send Message</span>
                  <ArrowRight className="w-[18px] h-[18px] text-white" size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* FAQ Section */}
        <div className="mx-4 mt-5 mb-10">
          <h2 className="text-xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          <div className="space-y-2.5">
            {faqs.map((item, index) => (
              <div key={index} className="bg-slate-800 rounded-lg p-3">
                <h3 className="text-white font-semibold mb-1">{item.q}</h3>
                <p className="text-slate-300 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUsPage;
