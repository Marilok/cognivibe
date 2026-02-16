"use client";

import { Modal, ModalContent, Button } from "@heroui/react";
import { useState } from "react";

// Import tour slide images
import tourSlide1 from "../../assets/tour-slide-1.png";

interface TourSlide {
  title: string;
  description: string;
  image: string;
}

// Tour slides data - add more slides here as needed
const tourSlides: TourSlide[] = [
  {
    title: "Welcome to the fitness tracker for your brain!",
    description:
      "We track how you interact with your computer – typing speed, window switching – and through a science-based approach calculate your focus and stress levels.",
    image: tourSlide1,
  },
  // Add more slides here later
];

interface TourModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onComplete?: () => void;
}

const TourModal = ({ isOpen, onOpenChange, onComplete }: TourModalProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const currentSlideData = tourSlides[currentSlide];
  const isLastSlide = currentSlide === tourSlides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      // Complete the tour
      setCurrentSlide(0); // Reset for next time
      onOpenChange(false);
      if (onComplete) {
        onComplete();
      }
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setCurrentSlide(0); // Reset when closing
    }
    onOpenChange(open);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      size="3xl"
      backdrop="blur"
      classNames={{
        base: "bg-content1 border border-white/10",
        closeButton: "top-4 right-4 text-white/60 hover:text-white",
      }}
      hideCloseButton={false}
    >
      <ModalContent>
        {() => (
          <div className="flex flex-col min-h-[600px]">
            {/* Top section - Text content */}
            <div className="px-10 pt-10 pb-6">
              <h1
                className="text-3xl font-bold text-white mb-4 leading-tight"
                style={{ fontStyle: "italic" }}
              >
                {currentSlideData.title}
              </h1>
              <p className="text-base text-white/70 max-w-xl">
                {currentSlideData.description}
              </p>
            </div>

            {/* Middle section - Image */}
            <div className="flex-1 relative overflow-hidden flex items-end justify-center px-6">
              <img
                src={currentSlideData.image}
                alt="Tour illustration"
                className="max-w-full max-h-[380px] object-contain"
                style={{
                  filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
                }}
              />
            </div>

            {/* Bottom section - Navigation */}
            <div className="px-10 pb-8 pt-4 flex justify-between items-center">
              {/* Slide indicators */}
              <div className="flex gap-2">
                {tourSlides.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentSlide
                        ? "bg-primary"
                        : "bg-white/20"
                    }`}
                  />
                ))}
              </div>

              {/* Next button */}
              <Button
                className="bg-transparent text-primary text-lg px-6"
                size="lg"
                variant="light"
                onPress={handleNext}
              >
                {isLastSlide ? "GET STARTED" : "NEXT"}
              </Button>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default TourModal;
