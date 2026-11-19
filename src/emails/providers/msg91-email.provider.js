import axios from "axios";
import https from "https";
import { logger } from "../../utils/logger.util.js";

export class Msg91EmailProvider {
  constructor(config = {}) {
    this.config = config;
    this.authKey =
      config.msg91?.authKey ||
      process.env.MSG91_AUTH_KEY ||
      "554888AWfuLg9q9pXN6a6b3658P1";
    this.fromEmail =
      config.msg91?.fromEmail ||
      config.fromEmail ||
      process.env.MSG91_FROM_EMAIL ||
      "no-reply@sahayaone.com";
    this.fromName =
      config.msg91?.fromName ||
      config.fromName ||
      process.env.MSG91_FROM_NAME ||
      "Sahayaone Credit";
    this.domain =
      config.msg91?.domain ||
      process.env.MSG91_EMAIL_DOMAIN ||
      "sahayaone.com";

    this.httpsAgent = new https.Agent({
      keepAlive: false,
      rejectUnauthorized: true,
    });
  }

  async send(options) {
    const toEmail = Array.isArray(options.to) ? options.to[0] : options.to;
    const recipientName = options.name || options.recipientName || "";
    const templateId = options.templateId || options.template_id || null;

    logger.info(
      `MSG91 EMAIL DISPATCH: Dispatching email to [${toEmail}] using Template [${templateId || "HTML_BODY"}]`,
    );

    const url = "https://control.msg91.com/api/v5/email/send";
    const headers = {
      authkey: this.authKey,
      "Content-Type": "application/json",
    };

    let formattedAttachments = [];
    if (Array.isArray(options.attachments) && options.attachments.length > 0) {
      formattedAttachments = options.attachments
        .map((att) => {
          let base64File = "";
          const filename = att.name || att.filename || "document.pdf";

          if (typeof att.file === "string" && att.file.trim()) {
            base64File = att.file.includes(";base64,")
              ? att.file.split(";base64,")[1]
              : att.file;
          } else if (Buffer.isBuffer(att.content)) {
            base64File = att.content.toString("base64");
          } else if (Buffer.isBuffer(att.buffer)) {
            base64File = att.buffer.toString("base64");
          } else if (Buffer.isBuffer(att.file)) {
            base64File = att.file.toString("base64");
          }

          
          if (!base64File) return null;

          let fileDataUri = base64File.trim();
          if (!fileDataUri.startsWith("data:")) {
            const ext = filename.split(".").pop().toLowerCase();
            let mimeType = "application/pdf";
            if (ext === "png") mimeType = "image/png";
            else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
            else if (ext === "csv") mimeType = "text/csv";

            fileDataUri = `data:${mimeType};base64,${fileDataUri}`;
          }

          return {
            name: filename,
            file: fileDataUri,
          };
        })
        .filter(Boolean);
    }

    const payload = {
      recipients: [
        {
          to: [
            {
              email: toEmail,
              name: recipientName,
            },
          ],
          variables: options.variables || {},
        },
      ],
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      domain: this.domain,
      ...(templateId
        ? { template_id: templateId }
        : {
            subject: options.subject || "Sahayaone Notification",
            body: options.html || options.text || "<p>Sahayaone Notification</p>",
          }),
      ...(formattedAttachments.length > 0
        ? { attachments: formattedAttachments }
        : {}),
    };

    try {
      logger.info(
        `MSG91 EMAIL PAYLOAD DEBUG: to=[${toEmail}], template=[${templateId || "HTML"}], attachments=[${formattedAttachments.length}], domain=[${this.domain}], from=[${this.fromEmail}]`,
      );
      if (formattedAttachments.length > 0) {
        formattedAttachments.forEach((att, i) => {
          logger.info(`MSG91 ATTACHMENT[${i}]: name=${att.name}, base64Length=${att.file?.length || 0}`);
        });
      }

      const response = await axios.post(url, payload, {
        headers,
        timeout: 30000,
        httpsAgent: this.httpsAgent,
      });

      if (
        response.data?.status === "success" ||
        response.data?.type === "success" ||
        response.status === 200
      ) {
        logger.info(
          `MSG91 EMAIL SUCCESS: Email dispatched to [${toEmail}]. MessageId: ${response.data?.data?.unique_id || "success"}`,
        );
        return {
          success: true,
          provider: "MSG91_EMAIL",
          messageId: response.data?.data?.unique_id || "success",
          response: response.data,
        };
      } else {
        throw new Error(
          response.data?.message || "MSG91 email delivery failed.",
        );
      }
    } catch (err) {
      const errorDetail = err.response?.data
        ? JSON.stringify(err.response.data)
        : err.message;
      logger.error(
        `MSG91 EMAIL EXCEPTION: Failed dispatching email to [${toEmail}]: ${errorDetail}`,
      );
      return {
        success: false,
        provider: "MSG91_EMAIL",
        error: errorDetail,
        details: err.response?.data,
      };
    }
  }
}
