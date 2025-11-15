import React from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import GlassmorphicContentCard from "./GlassmorphicContentCard";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";

interface GlassmorphicContentCardWrapperProps {
  title: string;
  titleGradient: string;
  content: string;
  fontSize: string;
  variant: "landscape" | "portrait";
  itemType: string;
}

/**
 * GlassmorphicContentCardWrapper component
 *
 * Wraps the GlassmorphicContentCard to display formatted content items
 * with appropriate styling based on content type.
 */
const GlassmorphicContentCardWrapper: React.FC<
  GlassmorphicContentCardWrapperProps
> = ({ title, titleGradient, content, fontSize, variant, itemType }) => {
  const theme = useTheme();
  const { fontSizes } = useResponsiveFontSize();

  // Determine color type based on item type
  let colorType: "primary" | "secondary" | "info" = "primary";
  let isUrgent = false;

  switch (itemType) {
    case "ANNOUNCEMENT":
      colorType = "secondary";
      break;
    case "EVENT":
      colorType = "info";
      break;
    case "VERSE_HADITH":
      colorType = "primary";
      break;
    default:
      colorType = "primary";
  }

  // Check if item is marked as urgent
  if (
    title.toLowerCase().includes("urgent") ||
    title.toLowerCase().includes("important") ||
    title.toLowerCase().includes("emergency")
  ) {
    isUrgent = true;
  }

  // Try to parse content if it's a JSON string
  const formatVerseHadithContent = () => {
    try {
      // Check if the content is JSON string
      if (content.startsWith("{") && content.includes('"type"')) {
        const parsedContent = JSON.parse(content);
        const arabicText = parsedContent.arabicText || "";
        const translation = parsedContent.translation || "";
        const reference = parsedContent.reference || parsedContent.source || "";

        return (
          <>
            {arabicText && (
              <Typography
                className="arabic-text"
                sx={{
                  fontSize: fontSize,
                  lineHeight: 1.6,
                  textAlign: "center",
                  color: "#FFFFFF",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                  mb: 3,
                  fontWeight: "medium",
                  direction: "rtl",
                }}
              >
                {arabicText}
              </Typography>
            )}

            {translation && (
              <Typography
                sx={{
                  fontSize: arabicText ? fontSizes.h6 : fontSize,
                  lineHeight: 1.6,
                  textAlign: "center",
                  color: "#FFFFFF",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                  fontFamily: "'Poppins', Arial, sans-serif",
                  mb: 3,
                }}
              >
                {translation}
              </Typography>
            )}

            {reference && (
              <Typography
                sx={{
                  fontSize: fontSizes.body2,
                  textAlign: "center",
                  color: alpha("#FFFFFF", 0.85),
                  fontStyle: "italic",
                  marginTop: "auto",
                  fontFamily: "'Poppins', Arial, sans-serif",
                  mt: 2,
                }}
              >
                {reference}
              </Typography>
            )}
          </>
        );
      }
    } catch (e) {
      console.error("Error parsing JSON content:", e);
      // Fall through to regular content formatting
    }

    // Handle regular string content
    return null;
  };

  // Format content based on type
  const formatContent = () => {
    if (itemType === "VERSE_HADITH") {
      // Try JSON parsing first
      const jsonContent = formatVerseHadithContent();
      if (jsonContent) return jsonContent;

      // More flexible parsing for regular text verse/hadith content
      let verseText = "";
      let reference = "";

      // Try different parsing approaches
      if (content.includes("\n\n")) {
        // Standard format with double newline
        const parts = content.split("\n\n");
        verseText = parts[0];
        reference = parts.slice(1).join("\n\n");
      } else if (content.includes("\n")) {
        // Format with single newlines, use last line as reference
        const lines = content.split("\n");
        if (lines.length > 1) {
          reference = lines.pop() || "";
          verseText = lines.join("\n");
        } else {
          verseText = content;
        }
      } else {
        // No clear separation, just use the whole content
        verseText = content;
      }

      return (
        <>
          <Typography
            sx={{
              fontSize,
              lineHeight: 1.6,
              textAlign: "center",
              color: "#FFFFFF",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
              fontFamily: "'Poppins', Arial, sans-serif",
              mb: 3,
              fontWeight: "medium",
            }}
          >
            {verseText}
          </Typography>

          {reference && (
            <Typography
              sx={{
                fontSize: fontSizes.body2,
                textAlign: "center",
                color: alpha("#FFFFFF", 0.85),
                fontStyle: "italic",
                marginTop: "auto",
                fontFamily: "'Poppins', Arial, sans-serif",
                mt: 2,
              }}
            >
              {reference}
            </Typography>
          )}
        </>
      );
    }

    // Default rendering for all other content types
    return (
      <Typography
        sx={{
          fontSize,
          lineHeight: 1.5,
          textAlign: "center",
          whiteSpace: "pre-line",
          color: "#FFFFFF",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
          fontFamily: "'Poppins', Arial, sans-serif",
        }}
      >
        {content}
      </Typography>
    );
  };

  return (
    <GlassmorphicContentCard
      orientation={variant}
      colorType={colorType}
      isUrgent={isUrgent}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start", // Revert to flex-start to maintain original layout
          alignItems: "center",
          padding: 3,
          height: "100%",
          overflow: "auto",
        }}
      >
        {/* Title with white color and color tint */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            marginBottom: 3,
            textAlign: "center",
            color: "#FFFFFF",
            textShadow: `0 0 10px ${theme.palette[colorType].main}`,
            fontFamily: "'Poppins', Arial, sans-serif",
            width: "100%",
          }}
        >
          {title}
        </Typography>

        {/* Content centered in the card */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            flex: 1,
            overflow: "auto",
            py: 2, // Add vertical padding instead of changing container dimensions
          }}
        >
          {formatContent()}
        </Box>
      </Box>
    </GlassmorphicContentCard>
  );
};

export default GlassmorphicContentCardWrapper;
