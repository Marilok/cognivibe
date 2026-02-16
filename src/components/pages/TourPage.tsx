"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createSupabaseClient } from "../../utils/createSupabaseClient";
import { markTutorialOpened } from "../../utils/userApi";

// Import tour slide images
import tourSlide1 from "../../assets/tour-slide-1.png";
import tourSlide2 from "../../assets/tour-slide-2.png";
import tourSlide3 from "../../assets/tour-slide-3.png";
import tourSlide4 from "../../assets/tour-slide-4.png";
import tourSlide5 from "../../assets/tour-slide-5.png";

interface TourSlide {
  title: string;
  description: string;
  image: string;
}

// Tour slides data
const tourSlides: TourSlide[] = [
  {
    title: "Welcome to the fitness tracker for your mind",
    description:
      "Cognivibe learns from how you work - typing, mouse, window switching - to estimate your cognitive load and help you find better focus.",
    image: tourSlide1,
  },
  {
    title: "Your cognitive load score will appear soon",
    description:
      "Turn tracking on and you will start seeing your score shortly. Treat it like a mind performance meter: higher usually means more mental effort and pressure.",
    image: tourSlide2,
  },
  {
    title: "Calibration takes around a week",
    description:
      "Your baseline is personal. After about a week of normal use, Cognivibe gets noticeably better at reading your patterns. Keep tracking on during your real work.",
    image: tourSlide3,
  },
  {
    title: "See where your time goes",
    description:
      "Alongside cognitive load, Cognivibe gives you a simple overview of how your day is spent. Privacy first: we do not send sensitive content, only high-level signals and categories.",
    image: tourSlide4,
  },
  {
    title: "Help us improve Cognivibe",
    description:
      "This is an early public release and we are still tuning accuracy. Quick 30-second check-ins from time to time help calibrate your scores and improve the product.",
    image: tourSlide5,
  },
];

function TourPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const currentSlideData = tourSlides[currentSlide];
  const isLastSlide = currentSlide === tourSlides.length - 1;

  const handleNext = async () => {
    if (isLastSlide) {
      // Mark tutorial as opened in the database
      try {
        const supabase = createSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          console.log("[TOUR] Marking tutorial as opened...");
          await markTutorialOpened(session.access_token);
          console.log("[TOUR] Tutorial marked as opened successfully");
        } else {
          console.warn("[TOUR] No session found, skipping tutorial completion API call");
        }
      } catch (error) {
        console.error("[TOUR] Failed to mark tutorial as opened:", error);
        // Continue to close window even if API call fails
      }

      // Close the tour window
      try {
        const currentWindow = getCurrentWindow();
        console.log("[TOUR] Closing tour window...");
        await currentWindow.destroy();
      } catch (error) {
        console.error("[TOUR] Failed to close window:", error);
        // Fallback: try close instead of destroy
        try {
          const currentWindow = getCurrentWindow();
          await currentWindow.close();
        } catch (e) {
          console.error("[TOUR] Fallback close also failed:", e);
        }
      }
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Background image - fills entire window, fully opaque */}
      <img
        src={currentSlideData.image}
        alt="Tour background"
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{ opacity: 1 }}
      />

      {/* Subtle gradient overlay for text readability at top */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(25,20,28,0.7) 0%, rgba(25,20,28,0.1) 35%, transparent 50%)",
        }}
      />

      {/* Content layer - on top of background */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top section - Text content (centered) */}
        <div className="px-12 pt-12 pb-6 flex-shrink-0 text-center">
          <h1 className="text-4xl font-bold text-white mb-5 leading-tight max-w-lg mx-auto">
            {currentSlideData.title}
          </h1>
          <p className="text-base text-white/80 max-w-2xl leading-relaxed mx-auto">
            {currentSlideData.description}
          </p>
        </div>

        {/* Spacer to push navigation to bottom */}
        <div className="flex-1" />

        {/* Bottom section - Navigation */}
        <div className="px-12 py-8 flex justify-end items-center flex-shrink-0">
          {/* Slide indicators - only show when more than one slide */}
          {tourSlides.length > 1 && (
            <div className="flex gap-2 mr-auto">
              {tourSlides.map((_, index) => (
                <div
                  key={index}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    index === currentSlide ? "bg-primary" : "bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Next/End button - white background, purple text, no focus ring */}
          <Button
            className="bg-white text-primary text-lg px-8 focus:outline-none focus:ring-0"
            size="lg"
            onPress={handleNext}
          >
            {isLastSlide ? "END" : "NEXT"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TourPage;
