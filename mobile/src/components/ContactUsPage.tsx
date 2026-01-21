import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import {
  Ionicons,
  Feather,
  FontAwesome,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import api from "../utils/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ContactUsPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user ID if logged in
      let userId = null;
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          userId = user.id || user._id;
        }
      } catch (error) {
        // User not logged in, continue without userId
      }

      // Submit feedback to backend
      const response = await api.post('/feedback', {
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
        userId: userId,
      });

      if (response.data.success) {
        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          setFormData({ name: "", email: "", subject: "", message: "" });
        }, 3000);
      } else {
        Alert.alert("Error", response.data.message || "Failed to submit feedback. Please try again.");
      }
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || error.message || "Failed to submit feedback. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const supportCategories = [
    "General Inquiry",
    "Technical Support",
    "Tournament Issues",
    "Community Problems",
    "Account Issues",
    "Game Borrowing",
    "Payment & Billing",
    "Feature Request",
    "Bug Report",
    "Partnership Inquiry",
  ];

  const faqs = [
    {
      q: "How do I join a tournament?",
      a: "Go to the Tournaments page, find a tournament, and tap 'Register Now'.",
    },
    {
      q: "Can I borrow games from others?",
      a: "Yes! Visit Game Borrowing to request available games from other users.",
    },
    {
      q: "How do I create or join a community?",
      a: "Go to Communities to browse or create your own group based on interests.",
    },
    {
      q: "What are the system requirements?",
      a: "GamerHive works smoothly on any modern device with internet access.",
    },
  ];

  if (isSubmitted) {
    return (
      <View style={styles.submittedContainer}>
        <View style={styles.iconCircle}>
          <Feather name="check-circle" size={60} color="#fff" />
        </View>
        <Text style={styles.successTitle}>Feedback Submitted!</Text>
        <Text style={styles.successMessage}>
          Thank you for contacting us. We'll respond within 24 hours.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Contact Us</Text>
          <Text style={styles.headerSubtitle}>
            Have questions or feedback? Reach out to us anytime.
          </Text>
        </View>

        {/* Contact Form */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Send us a Message</Text>

          {/* Name */}
          <View style={styles.inputGroup}>
            <Feather name="user" size={20} color="#a78bfa" style={styles.icon} />
            <TextInput
              placeholder="Full Name"
              placeholderTextColor="#aaa"
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => handleInputChange("name", text)}
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <MaterialCommunityIcons
              name="email-outline"
              size={20}
              color="#a78bfa"
              style={styles.icon}
            />
            <TextInput
              placeholder="Email Address"
              placeholderTextColor="#aaa"
              keyboardType="email-address"
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => handleInputChange("email", text)}
            />
          </View>

          {/* Subject */}
          <View style={styles.inputGroup}>
            <MaterialIcons name="subject" size={20} color="#a78bfa" style={styles.icon} />
            <TextInput
              placeholder="Subject"
              placeholderTextColor="#aaa"
              style={styles.input}
              value={formData.subject}
              onChangeText={(text) => handleInputChange("subject", text)}
            />
          </View>

          {/* Message */}
          <View style={styles.textAreaContainer}>
            <FontAwesome name="commenting-o" size={20} color="#a78bfa" style={styles.icon} />
            <TextInput
              placeholder="Your Message"
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={6}
              style={styles.textArea}
              value={formData.message}
              onChangeText={(text) => handleInputChange("message", text)}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, isSubmitting && { opacity: 0.7 }]}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>Send Message</Text>
                <Feather name="arrow-right" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqContainer}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {faqs.map((item, index) => (
            <View key={index} style={styles.faqBox}>
              <Text style={styles.faqQuestion}>{item.q}</Text>
              <Text style={styles.faqAnswer}>{item.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    padding: 20,
    backgroundColor: "#1e1b4b",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#d8b4fe",
    textAlign: "center",
    marginTop: 8,
  },
  formContainer: {
    backgroundColor: "#1e293b",
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#334155",
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  icon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: "#fff",
    paddingVertical: 10,
  },
  textAreaContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#334155",
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  textArea: {
    flex: 1,
    color: "#fff",
    textAlignVertical: "top",
    paddingVertical: 10,
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#7c3aed",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    marginRight: 8,
  },
  faqContainer: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  faqBox: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  faqQuestion: {
    color: "#fff",
    fontWeight: "600",
    marginBottom: 4,
  },
  faqAnswer: {
    color: "#cbd5e1",
  },
  submittedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 20,
  },
  iconCircle: {
    backgroundColor: "#10b981",
    borderRadius: 60,
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  successMessage: {
    color: "#d8b4fe",
    textAlign: "center",
    fontSize: 15,
  },
});

export default ContactUsPage;
