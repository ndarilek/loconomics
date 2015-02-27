﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using WebMatrix.Data;
using System.Web.Helpers;
using ASP;
using System.Net;
using System.Web.Caching;

/// <summary>
/// Descripción breve de LcMessaging
/// </summary>
public class LcMessaging
{
    #region SQLs
    private static readonly string sqlInsThread = @"
        INSERT INTO [MessagingThreads]
                   ([CustomerUserID]
                   ,[ProviderUserID]
                   ,[PositionID]
                   ,[MessageThreadStatusID]
                   ,[Subject]
                   ,[CreatedDate]
                   ,[UpdatedDate]
                   ,[ModifiedBy])
             VALUES
                   (@0, @1, @2,
                    1, -- Status is 1 ever at first message (not responded)
                    @3,
                    getdate(), getdate(), 'sys')
        SELECT @@Identity As MessagingThreadID
    ";
    private static readonly string sqlUpdThread = @"
        UPDATE MessagingThreads
        SET     MessageThreadStatusID = coalesce(@1, MessagingThreads.MessageThreadStatusID),
                LastMessageID = @2,
                Subject = coalesce(@3, MessagingThreads.Subject),
                UpdatedDate = getdate(),
                ModifiedBy = 'sys'
        WHERE   ThreadID = @0
    ";
    private static readonly string sqlInsMessage = @"
        INSERT INTO [Messages]
                   (ThreadID
                   ,MessageTypeID
                   ,BodyText
                   ,AuxID
                   ,AuxT
                   ,[CreatedDate]
                   ,[UpdatedDate]
                   ,[ModifiedBy])
            VALUES (@0, @1, @2, @3, @4, getdate(), getdate(), 'sys')
        SELECT @@Identity As MessageID
    ";
    private static readonly string sqlGetThread = @"
        SELECT CustomerUserID, ProviderUserID, PositionID, MessageThreadStatusID, Subject
        FROM    MessagingThreads
        WHERE   ThreadID = @0
    ";
    private static readonly string sqlGetUserData = @"
        SELECT  U.FirstName, U.LastName, U.UserID, P.Email
        FROM Users As U
              INNER JOIN
             UserProfile As P
               ON U.UserID = P.UserID
        WHERE   U.UserID = @0
    ";
    private static readonly string sqlGetThreadByAux = @"
        SELECT  ThreadID, CustomerUserID, ProviderUserID, PositionID, MessageThreadStatusID, Subject
        FROM    MessagingThreads
        WHERE   ThreadID = (
                SELECT TOP 1 ThreadID
                FROM Messages
                WHERE Messages.AuxID = @0 -- BookingID, BookingRequestID or another posible Auxiliar IDs
                       AND
                      Messages.AuxT = @1 -- Table/Type AuxID name
            )
    ";
    #endregion

    #region Database operations
    /// <summary>
    /// Returns the new MessageID
    /// 
    ///MessageTypeID	MessageTypeName
    ///1	Customer inquiry
    ///2	Copy of customer inquiry
    ///3	Provider response to inquiry
    ///4	Customer booking request
    ///5	Copy of customer booking request
    ///6	Customer booking confirmation
    ///7	Provider booking confirmation
    ///8	Customer marketing
    ///9	Customer dispute
    ///10	Provider resolution
    ///11	Provider review
    ///12	Pricing adjustment to provider
    /// </summary>
    /// <param name="CustomerUserID"></param>
    /// <param name="ProviderUserID"></param>
    /// <param name="PositionID"></param>
    /// <param name="FirstMessageTypeID"></param>
    /// <param name="FirstMessageBody"></param>
    /// <returns></returns>
    public static int CreateThread(int CustomerUserID, int ProviderUserID, int PositionID, string ThreadSubject, int FirstMessageTypeID, string FirstMessageBody, int FirstMessageAuxID = -1, string FirstMessageAuxT = null)
    {
        int threadID = 0;
        using (var db = Database.Open("sqlloco"))
        {
            threadID = (int)db.QueryValue(sqlInsThread, CustomerUserID, ProviderUserID, PositionID, ThreadSubject);
            int messageID = (int)db.QueryValue(sqlInsMessage, threadID, FirstMessageTypeID, FirstMessageBody, (FirstMessageAuxID == -1 ? null : (object)FirstMessageAuxID), FirstMessageAuxT);
            // Update created thread with the lastMessageID
            db.Execute(sqlUpdThread, threadID, null, messageID, null);
        }
        return threadID;
    }
    /// <summary>
    /// Returns the new MessageID
    ///MessageTypeID	MessageTypeName
    ///1	Customer inquiry
    ///2	Copy of customer inquiry
    ///3	Provider response to inquiry
    ///4	Customer booking request
    ///5	Copy of customer booking request
    ///6	Customer booking confirmation
    ///7	Provider booking confirmation
    ///8	Customer marketing
    ///9	Customer dispute
    ///10	Provider resolution
    ///11	Provider review
    ///12	Pricing adjustment to provider
    /// </summary>
    /// <param name="ThreadID"></param>
    /// <param name="MessageTypeID"></param>
    /// <param name="MessageBody"></param>
    /// <returns></returns>
    public static int CreateMessage(int ThreadID, int MessageThreadStatusID, int MessageTypeID, string MessageBody, int MessageAuxID = -1, string MessageAuxT = null, string NewThreadSubject = null)
    {
        int messageID = 0;
        using (var db = Database.Open("sqlloco"))
        {
            // Create Message
            messageID = (int)db.QueryValue(sqlInsMessage, ThreadID, MessageTypeID, MessageBody, (MessageAuxID == -1 ? null : (object)MessageAuxID), MessageAuxT);
            // Update Thread status (and date automatically)
            db.Execute(sqlUpdThread, ThreadID, MessageThreadStatusID, messageID, NewThreadSubject);
        }
        return messageID;
    }
    #endregion

    #region Database queries (showing list, details, etc)
    private static readonly Dictionary<string, string> sqlListMessageThread = new Dictionary<string,string> {
    { "select", "SELECT " },    
    { "select-fields", @"
                T.ThreadID,
                T.CustomerUserID,
                T.ProviderUserID,
                T.PositionID,
                T.MessageThreadStatusID,
                T.UpdatedDate As LastMessageDate,
                T.Subject,

                T.LastMessageID,
                M.BodyText As LastMessageBodyText,
                M.MessageTypeID As LastMessageTypeID,
                M.AuxID As LastMessageAuxID,
                M.AuxT As LastMessageAuxT,
                M.SentByUserID As LastMessageSendByUserID,

                UC.FirstName As CustomerFirstName,
                UC.LastName As CustomerLastName,

                UP.FirstName As ProviderFirstName,
                UP.LastName As ProviderLastName,

                Pos.PositionSingular
    "},
    { "from", @"
        FROM    MessagingThreads As T
                 INNER JOIN
                Messages As M
                  ON M.ThreadID = T.ThreadID
                      AND
                     M.MessageID = T.LastMessageID
                 INNER JOIN
                Users As UC
                  ON UC.UserID = T.CustomerUserID
                 INNER JOIN
                Users As UP
                  ON UP.UserID = T.ProviderUserID
                 INNER JOIN
                Positions As Pos
                  ON Pos.PositionID = T.PositionID
					AND Pos.CountryID = @2 AND Pos.LanguageID = @1
    "},
    { "where", @"
        WHERE   (T.CustomerUserID = @0 OR T.ProviderUserID = @0)
    "},
    { "order-by", @"
        ORDER BY T.UpdatedDate DESC
    "},
    };
    public static dynamic GetMessageThreadList(int userID)
    {
        var sql = String.Join(" ", sqlListMessageThread.Values);
        using (var db = Database.Open("sqlloco")) {
            return db.Query(sql, userID, LcData.GetCurrentLanguageID(), LcData.GetCurrentCountryID());
        }
    }
    public static Dictionary<string, dynamic> GetLastNewReadSentMessages(int userID, int maxPerType = 3)
    {
        var commonSql = 
            "SELECT TOP " + maxPerType + " " +
            sqlListMessageThread["select-fields"] + 
            sqlListMessageThread["from"] + 
            sqlListMessageThread["where"];
        var order = sqlListMessageThread["order-by"];
        var sqlNew = commonSql + " AND T.MessageThreadStatusID = 1 AND M.SentByUserID <> @0 " + order;
        var sqlRead = commonSql + " AND T.MessageThreadStatusID = 2 AND M.SentByUserID <> @0 " + order;
        var sqlSent = commonSql + " AND M.SentByUserID = @0 " + order;
        var sqlList = new Dictionary<string, string> {
            { "new", sqlNew },
            { "read", sqlRead },
            { "sent", sqlSent }
        };

        var ret = new Dictionary<string, dynamic>();
        using (var db = Database.Open("sqlloco")) {
            foreach (var sql in sqlList)
            {
                dynamic d = db.Query(sql.Value, userID, LcData.GetCurrentLanguageID(), LcData.GetCurrentCountryID());
                if (d != null && d.Count > 0)
                    ret[sql.Key] = d;
            }
        }
        return ret;
    }
    #endregion

    #region Message Summary (building small reusable summaries, as of messages listings)
    public class MessageSummary
    {
        private dynamic r;
        private int displayToUserID;

        public MessageSummary(dynamic messageRecord, int displayToUserID)
        {
            this.r = messageRecord;
            this.displayToUserID = displayToUserID;
        }

        public static List<int> BookingRelatedMessageTypes = new List<int> {
            4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 19, 17, 18
        };

        public string GetMessageTypeDependantSubject() {
            var ret = "";
            if (BookingRelatedMessageTypes.Contains((int)r.LastMessageTypeID)) {
                ret = "for ";
            } else {
                ret = "about ";
            }
            ret += r.PositionSingular + " services";
            return ret;
        }

        public string GetThreadParticipantFirstName() {
            if (r.ProviderUserID == displayToUserID) {
                return r.CustomerFirstName;
            } else {
                return r.ProviderFirstName;
            }
        }

        public string GetMessageUrl(string baseUrl = null) {
            if (baseUrl == null)
            {
                baseUrl = LcUrl.LangPath + "dashboard/";
            }
            var url = baseUrl;
            switch ((string)r.LastMessageAuxT) {
                default:
                    url += "Messages/Inquiry/" + r.ThreadID + "/" + r.LastMessageID + "/";
                    break;
                case "Booking":
                    url += "Messages/Booking/" + r.LastMessageAuxID + "/";
                    break;
                case "BookingRequest":
                    url += "Messages/BookingRequest/" + r.LastMessageAuxID + "/";
                    break;
            }
            return url;
        }

        public string GetMessageTypeLabel() {
            var ret = "";
            switch((int)r.LastMessageTypeID) {
                default:            
                case 1:
                case 2:
                case 3:
                    ret = "Message";
                    break;
                case 4:
                case 5:
                    ret = "Booking request";
                    break;
                case 6:
                case 7:
                    ret = "Booking confirmation";
                    break;
                case 8:
                    ret = "Marketing";
                    break;
                case 9:
                    ret = "Booking dispute";
                    break;
                case 10:
                    ret = "Booking resolution";
                    break;
                case 12:
                    ret = "Pricing adjustment";
                    break;
                case 13:
                    ret = "Booking declined";
                    break;
                case 14:
                    ret = "Booking cancelled";
                    break;
                case 15:
                case 16:
                case 19:
                    ret = "Booking update";
                    break;
                case 17:
                case 18:
                    ret = "Booking review";
                    break;
            }
            return ret;
        }
    }
    #endregion

    #region Type:Booking and Booking Request
    /// <summary>
    /// A Booking Request is ever sent by a customer
    /// </summary>
    /// <param name="CustomerUserID"></param>
    /// <param name="ProviderUserID"></param>
    /// <param name="PositionID"></param>
    /// <param name="BookingRequestID"></param>
    public static void SendBookingRequest(int CustomerUserID, int ProviderUserID, int PositionID, int BookingRequestID)
    {
        dynamic customer = null, provider = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Customer information
            customer = db.QuerySingle(sqlGetUserData, CustomerUserID);
            // Get Provider information
            provider = db.QuerySingle(sqlGetUserData, ProviderUserID);
        }
        if (customer != null && provider != null)
        {
            // Create message subject and message body based on detailed booking data
            string subject = LcData.Booking.GetBookingRequestSubject(BookingRequestID);
            string message = LcData.Booking.GetOneLineBookingRequestPackages(BookingRequestID);

            int threadID = CreateThread(CustomerUserID, ProviderUserID, PositionID, subject, 4, message, BookingRequestID, "BookingRequest");

            SendMail(provider.Email, "[Action Required] " + LcData.Booking.GetBookingRequestTitleFor(2, customer, LcData.UserInfo.UserType.Provider), 
                ApplyTemplate(LcUrl.LangPath + "Booking/Email/EmailBookingDetailsPage/",
                new Dictionary<string, object> {
                { "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Provider" }
                ,{ "SentBy", "Customer" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", provider.Email }
            }));
            SendMail(customer.Email, LcData.Booking.GetBookingRequestTitleFor(2, provider, LcData.UserInfo.UserType.Customer),
                ApplyTemplate(LcUrl.LangPath + "Booking/Email/EmailBookingDetailsPage/",
                new Dictionary<string, object> {
                { "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Customer" }
                ,{ "SentBy", "Customer" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", customer.Email }
            }));
        }
    }
    /// <summary>
    /// A Booking Confirmation is ever sent by a provider
    /// </summary>
    /// <param name="BookingRequestID"></param>
    /// <param name="BookingID"></param>
    /// <param name="sentByProvider"></param>
    public static void SendBookingRequestConfirmation(int BookingRequestID, int BookingID)
    {
        dynamic customer = null, provider = null, thread = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Thread info
            thread = db.QuerySingle(sqlGetThreadByAux, BookingRequestID, "BookingRequest");
            if (thread != null)
            {
                // Get Customer information
                customer = db.QuerySingle(sqlGetUserData, thread.CustomerUserID);
                // Get Provider information
                provider = db.QuerySingle(sqlGetUserData, thread.ProviderUserID);
            }
        }
        if (customer != null && provider != null)
        {
            // Create message body based on detailed booking data
            string subject = LcData.Booking.GetBookingSubject(BookingID);
            string message = LcData.Booking.GetOneLineBookingRequestPackages(BookingRequestID);

            // ThreadStatus=2, responded; MessageType=7 by provider (6 by customer; ONLY provider can confirm it)
            int messageID = CreateMessage(thread.ThreadID, 2, 7, message, BookingID, "Booking", subject);

            SendMail(provider.Email, LcData.Booking.GetBookingTitleFor(1, customer, LcData.UserInfo.UserType.Provider), 
                ApplyTemplate(LcUrl.LangPath + "Booking/Email/EmailBookingDetailsPage/",
                new Dictionary<string, object> {
                { "BookingID", BookingID }
                ,{ "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Provider" }
                ,{ "SentBy", "Provider" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", provider.Email }
            }));
            SendMail(customer.Email, LcData.Booking.GetBookingTitleFor(1, provider, LcData.UserInfo.UserType.Customer),
                ApplyTemplate(LcUrl.LangPath + "Booking/Email/EmailBookingDetailsPage/",
                new Dictionary<string, object> {
                { "BookingID", BookingID }
                ,{ "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Customer" }
                ,{ "SentBy", "Provider" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", customer.Email }
            }));
        }
    }

    public static void SendInstantBooking(int CustomerUserID, int ProviderUserID, int PositionID, int BookingRequestID, int BookingID)
    {
        dynamic customer = null, provider = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Customer information
            customer = db.QuerySingle(sqlGetUserData, CustomerUserID);
            // Get Provider information
            provider = db.QuerySingle(sqlGetUserData, ProviderUserID);
        }
        if (customer != null && provider != null)
        {
            // Create message body based on detailed booking data
            // TODO #520: say 'instant' in the subject?
            string subject = LcData.Booking.GetBookingSubject(BookingID);
            string message = LcData.Booking.GetOneLineBookingRequestPackages(BookingRequestID);

            // #520: MessageTypeID:6 "Booking Request Customer Confirmation"
            int threadID = CreateThread(CustomerUserID, ProviderUserID, PositionID, subject, 6, message, BookingID, "Booking");

            SendMail(provider.Email, LcData.Booking.GetBookingTitleFor(1, customer, LcData.UserInfo.UserType.Provider),
                ApplyTemplate(LcUrl.LangPath + "Booking/Email/EmailBookingDetailsPage/",
                new Dictionary<string, object> {
                { "BookingID", BookingID }
                ,{ "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Provider" }
                ,{ "SentBy", "Customer" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", provider.Email }
            }));
            SendMail(customer.Email, LcData.Booking.GetBookingTitleFor(1, provider, LcData.UserInfo.UserType.Customer),
                ApplyTemplate(LcUrl.LangPath + "Booking/Email/EmailBookingDetailsPage/",
                new Dictionary<string, object> {
                { "BookingID", BookingID }
                ,{ "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Customer" }
                ,{ "SentBy", "Customer" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", customer.Email }
            }));
        }
    }

    /// <summary>
    /// Booking created by the Provider, sent to the customer only
    /// </summary>
    /// <param name="CustomerUserID"></param>
    /// <param name="ProviderUserID"></param>
    /// <param name="PositionID"></param>
    /// <param name="BookingID"></param>
    public static void SendProviderBooking(int BookingID)
    {
        int CustomerUserID = 0;
        int ProviderUserID = 0;
        int PositionID = 0;
        int BookingRequestID = 0;
        dynamic customer = null, provider = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Booking info
            var booking = LcData.Booking.GetBookingBasicInfo(BookingID);
            CustomerUserID = booking.CustomerUserID;
            ProviderUserID = booking.ProviderUserID;
            PositionID = booking.PositionID;
            BookingRequestID = booking.BookingRequestID;
            // Get Customer information
            customer = db.QuerySingle(sqlGetUserData, CustomerUserID);
            // Get Provider information
            provider = db.QuerySingle(sqlGetUserData, ProviderUserID);
        }
        if (customer != null && provider != null)
        {
            // Create message body based on detailed booking data
            string subject = LcData.Booking.GetBookingSubject(BookingID);
            string message = LcData.Booking.GetOneLineBookingRequestPackages(BookingRequestID);

            // #520: MessageTypeID:15 "Booking Provider Update"
            int threadID = CreateThread(CustomerUserID, ProviderUserID, PositionID, subject, 15, message, BookingID, "Booking");

            SendMail(customer.Email, LcData.Booking.GetBookingTitleFor(1, provider, LcData.UserInfo.UserType.Customer),
                ApplyTemplate(LcUrl.LangPath + "Booking/Email/EmailBookingDetailsPage/",
                new Dictionary<string, object> {
                { "BookingID", BookingID }
                ,{ "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Customer" }
                ,{ "SentBy", "Provider" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", customer.Email }
            }));
        }
    }

    public static void SendBookingRequestDenegation(int BookingRequestID, bool sentByProvider)
    {
        // ThreadStatus=2, responded; MessageType=13-14 Booking Request denegation: 14 cancelled by customer, 13 declined by provider
        SendBookingRequestInvalidation(BookingRequestID, 2, sentByProvider ? 13 : 14);
    }
    /// <summary>
    /// Send and update of booking request that terminate it as 'invalid', normally after
    /// a LcData.Booking.InvalidateBookingRequest.
    /// Booking Request should had changed to some 'invalide' status, as 'cancelled', 'declined' or 'expired'
    /// </summary>
    /// <param name="BookingRequestID"></param>
    /// <param name="threadStatusID">1 for unresponded, 2 for responded</param>
    /// <param name="messageTypeID">Recommended types: 13 (provider declined), 14 (customer cancelled), 19 (booking updated)</param>
    public static void SendBookingRequestInvalidation(int BookingRequestID, int threadStatusID, int messageTypeID)
    {
        dynamic customer = null, provider = null, thread = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Thread info
            thread = db.QuerySingle(sqlGetThreadByAux, BookingRequestID, "BookingRequest");
            if (thread != null)
            {
                // Get Customer information
                customer = db.QuerySingle(sqlGetUserData, thread.CustomerUserID);
                // Get Provider information
                provider = db.QuerySingle(sqlGetUserData, thread.ProviderUserID);
            }
        }
        if (customer != null && provider != null)
        {
            // Create message body based on detailed booking data
            string message = LcData.Booking.GetOneLineBookingRequestPackages(BookingRequestID);
            var bookingRequest = LcData.Booking.GetBookingRequestBasicInfo(BookingRequestID);

            // ThreadStatus=2, responded;
            int messageID = CreateMessage(thread.ThreadID, threadStatusID, messageTypeID, message, BookingRequestID, "BookingRequest");

            // default value and explicit value for Status:2
            string emailTemplatePath = "Booking/Email/EmailBookingDetailsPage/";

            SendMail(provider.Email, LcData.Booking.GetBookingRequestTitleFor(bookingRequest.BookingRequestStatusID, customer, LcData.UserInfo.UserType.Provider),
                ApplyTemplate(LcUrl.LangPath + emailTemplatePath,
                new Dictionary<string, object> {
                { "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Provider" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", provider.Email }
            }));
            SendMail(customer.Email, LcData.Booking.GetBookingRequestTitleFor(bookingRequest.BookingRequestStatusID, provider, LcData.UserInfo.UserType.Customer),
                ApplyTemplate(LcUrl.LangPath + emailTemplatePath,
                new Dictionary<string, object> {
                { "BookingRequestID", BookingRequestID }
                ,{ "SentTo", "Customer" }
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", customer.Email }
            }));
        }
    }
    /// <summary>
    /// Send a message notifing of an update in the booking (status mainly, but maybe some data as price change or...),
    /// can be done by (bySystemProviderOrCustomer) a provider 'p', a customer 'c' or a sys-admin 's'
    /// </summary>
    /// <param name="BookingRequestID"></param>
    /// <param name="BookingID"></param>
    /// <param name="bySystemProviderOrCustomer"></param>
    /// <param name="onlyTo">'p' for provider and 'c' for customer. Will send the email only to that, or 'b' both by default</param>
    /// <param name="reminderType">Specify ONLY If the message is a Reminder. Set the kind of reminder (service, review-firstreminder, review)</param>
    /// <param name="messageTypeID">the parameter bySystemProviderOrCustomer choose automatically a messageTypeID from the 'update' types, but when
    /// another type is need that can be just specified here and will take precedence.</param>
    public static void SendBookingUpdate(int BookingID, char bySystemProviderOrCustomer, char onlyTo = 'b', string reminderType = null, int? messageTypeID = null)
    {
        dynamic customer = null, provider = null, thread = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Thread info
            thread = db.QuerySingle(sqlGetThreadByAux, BookingID, "Booking");
            if (thread != null)
            {
                // Get Customer information
                customer = db.QuerySingle(sqlGetUserData, thread.CustomerUserID);
                // Get Provider information
                provider = db.QuerySingle(sqlGetUserData, thread.ProviderUserID);
            }
        }
        if (customer != null && provider != null)
        {
            // Create message body based on detailed booking data
            string subject = LcData.Booking.GetBookingSubject(BookingID);
            string message = LcData.Booking.GetBookingStatus(BookingID);
            var booking = LcData.Booking.GetBookingBasicInfo(BookingID);

            // ThreadStatus=2, responded;
            // MessageType: 'p' provider 15, 'c' customer 16, 's' system 19
            int messageType = bySystemProviderOrCustomer == 'p' ? 15 : bySystemProviderOrCustomer == 'c' ? 16 : 19;
            if (messageTypeID.HasValue)
                messageType = messageTypeID.Value;
            int messageID = CreateMessage(thread.ThreadID, 2, messageType, message, BookingID, "Booking", subject);

            // default value and explicit value for Status:1
            string emailTemplatePath = "Booking/Email/EmailBookingDetailsPage/";
            if (reminderType == null)
            {
                switch ((int)booking.BookingStatusID)
                {
                    case 6:
                        emailTemplatePath = "Booking/EmailBookingCancelled/";
                        break;
                }
            }
            else
            {
                switch (reminderType)
                {
                    case "service":
                        emailTemplatePath = "Booking/EmailBookingReminder/";
                        break;
                    case "review-firstreminder":
                        emailTemplatePath = "Booking/EmailBookingReview/?FirstReminder=true";
                        break;
                    case "review":
                        emailTemplatePath = "Booking/EmailBookingReview/";
                        break;
                }
            }

            if (onlyTo == 'b' || onlyTo == 'p')
            {
                SendMail(provider.Email, LcData.Booking.GetBookingTitleFor(booking.BookingStatusID, customer, LcData.UserInfo.UserType.Provider),
                    ApplyTemplate(LcUrl.LangPath + emailTemplatePath,
                    new Dictionary<string, object> {
                    { "BookingID", BookingID }
                    ,{ "SentTo", "Provider" }
                    ,{ "SentBy", LcData.UserInfo.ParseUserType(bySystemProviderOrCustomer) }
                    ,{ "RequestKey", SecurityRequestKey }
                    ,{ "EmailTo", provider.Email }
                }));
            }
            if (onlyTo == 'b' || onlyTo == 'c')
            {
                SendMail(customer.Email, LcData.Booking.GetBookingTitleFor(booking.BookingStatusID, provider, LcData.UserInfo.UserType.Customer),
                    ApplyTemplate(LcUrl.LangPath + emailTemplatePath,
                    new Dictionary<string, object> {
                    { "BookingID", BookingID }
                    ,{ "SentTo", "Customer" }
                    ,{ "SentBy", LcData.UserInfo.ParseUserType(bySystemProviderOrCustomer) }
                    ,{ "RequestKey", SecurityRequestKey }
                    ,{ "EmailTo", customer.Email }
                }));
            }
        }
    }
    #endregion

    #region Type:Inquiry
    public static void SendCustomerInquiry(int CustomerUserID, int ProviderUserID, int PositionID, string InquirySubject, string InquiryText)
    {
        dynamic customer = null, provider = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Customer information
            customer = db.QuerySingle(sqlGetUserData, CustomerUserID);
            // Get Provider information
            provider = db.QuerySingle(sqlGetUserData, ProviderUserID);
        }
        if (customer != null && provider != null)
        {
            int threadID = CreateThread(CustomerUserID, ProviderUserID, PositionID, InquirySubject, 1, InquiryText);

            SendMail(provider.Email, "A Message From a Loconomics Provider", 
                ApplyTemplate(LcUrl.LangPath + "Messaging/EmailInquiry/",
                new Dictionary<string, object> {
                { "ThreadID", threadID }
                ,{ "Kind", 1 } // Customer inquiry (first message)
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", provider.Email }
            }));
            SendMail(customer.Email, "A Message From a Loconomics Client", 
                ApplyTemplate(LcUrl.LangPath + "Messaging/EmailInquiry/",
                new Dictionary<string, object> {
                { "ThreadID", threadID }
                ,{ "Kind", -1 } // Copy to author of Customer inquiry (first message)
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", customer.Email }
            }));
        }
    }
    public static void SendProviderInquiryAnswer(int ThreadID, string InquiryAnswer)
    {
        dynamic customer = null, provider = null, thread = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Thread info
            thread = db.QuerySingle(sqlGetThread, ThreadID);
            if (thread != null)
            {
                // Get Customer information
                customer = db.QuerySingle(sqlGetUserData, thread.CustomerUserID);
                // Get Provider information
                provider = db.QuerySingle(sqlGetUserData, thread.ProviderUserID);
            }
        }
        if (customer != null && provider != null)
        {
            // ThreadStatus=2, responded; MessageType=3, provider answer
            int messageID = CreateMessage(ThreadID, 2, 3, InquiryAnswer);

            SendMail(customer.Email, "A Message From a Loconomics Provider", 
                ApplyTemplate(LcUrl.LangPath + "Messaging/EmailInquiry/",
                new Dictionary<string, object> {
                { "ThreadID", ThreadID }
                ,{ "MessageID", messageID }
                ,{ "Kind", 2 } // Provider inquiry answer (second message and upper evens)
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", customer.Email }
            }));
            SendMail(provider.Email, "A Message From a Loconomics Client", 
                ApplyTemplate(LcUrl.LangPath + "Messaging/EmailInquiry/",
                new Dictionary<string, object> {
                { "ThreadID", ThreadID }
                ,{ "MessageID", messageID }
                ,{ "Kind", -2 } // Copy to author of Provider inquiry answer (second message and upper evens)
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", provider.Email }
            }));
        }
    }
    public static void SendCustomerInquiryAnswer(int ThreadID, string InquiryAnswer)
    {
        dynamic customer = null, provider = null, thread = null;
        using (var db = Database.Open("sqlloco"))
        {
            // Get Thread info
            thread = db.QuerySingle(sqlGetThread, ThreadID);
            if (thread != null)
            {
                // Get Customer information
                customer = db.QuerySingle(sqlGetUserData, thread.CustomerUserID);
                // Get Provider information
                provider = db.QuerySingle(sqlGetUserData, thread.ProviderUserID);
            }
        }
        if (customer != null && provider != null)
        {
            // ThreadStatus=1, respond; MessageType=1, customer inquiry
            int messageID = CreateMessage(ThreadID, 1, 1, InquiryAnswer);

            SendMail(provider.Email, "Loconomics.com: Inquiry", 
                ApplyTemplate(LcUrl.LangPath + "Messaging/EmailInquiry/",
                new Dictionary<string, object> {
                { "ThreadID", ThreadID }
                ,{ "MessageID", messageID }
                ,{ "Kind", 3 } // Customer inquiry answer (third message and upper odds)
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", provider.Email }
            }));
            SendMail(customer.Email, "Loconomics.com: Inquiry", 
                ApplyTemplate(LcUrl.LangPath + "Messaging/EmailInquiry/",
                new Dictionary<string, object> {
                { "ThreadID", ThreadID }
                ,{ "MessageID", messageID }
                ,{ "Kind", -3 } // Copy to author of Customer inquiry answer (third message and upper odds)
                ,{ "RequestKey", SecurityRequestKey }
                ,{ "EmailTo", customer.Email }
            }));
        }
    }
    #endregion

    #region Type:Welcome
    public static void SendWelcomeProvider(int providerID, string providerEmail, string confirmationURL)
    {
        SendMail(providerEmail, "[Action Required] Welcome to Loconomics-Please Verify Your Account",
            ApplyTemplate(LcUrl.LangPath + "Email/EmailWelcomeProvider/",
            new Dictionary<string,object> {
                { "UserID", providerID },
                { "EmailTo", providerEmail },
                { "ConfirmationURL", HttpUtility.UrlEncode(confirmationURL) }
         }));
    }
    public static void SendWelcomeCustomer(int userID, string userEmail, string confirmationURL, string confirmationToken)
    {
        SendMail(userEmail, "[Action Required] Welcome to Loconomics-Please Verify Your Account",
            ApplyTemplate(LcUrl.LangPath + "Email/EmailWelcomeCustomer/",
            new Dictionary<string, object> {
                { "UserID", userID },
                { "EmailTo", userEmail },
                { "ConfirmationURL", HttpUtility.UrlEncode(confirmationURL) },
                { "ConfirmationToken", HttpUtility.UrlEncode(confirmationToken) }
        }));
    }
    public static void SendResetPassword(int userID, string userEmail, string resetURL, string resetToken)
    {
        SendMail(userEmail, "[Action Required] Loconomics Password Recovery",
            ApplyTemplate(LcUrl.LangPath + "Email/EmailResetPassword/",
            new Dictionary<string, object> {
                { "UserID", userID },
                { "EmailTo", userEmail },
                { "ResetURL", HttpUtility.UrlEncode(resetURL) },
                { "ResetToken", HttpUtility.UrlEncode(resetToken) }
        }));
    }
    #endregion

    #region Type:ReportAbuse
    public static void SendReportUnauthorizedUse(int reportedByUserID, int reportedUserID, string message)
    {
        SendMail("legal@loconomics.com", "Report of Unauthorized Use",
            ApplyTemplate(LcUrl.LangPath + "Email/EmailReportUnauthorizedUse/",
            new Dictionary<string,object> {
                { "ReportedByUserID", reportedByUserID },
                { "ReportedUserID", reportedUserID },
                { "Message", message },
                { "EmailTo", "legal@loconomics.com" }
         }));
    }
    #endregion

    #region Type:Request provider payment to Loconomics Stuff Users
    /// <summary>
    /// OBSOLETE.
    /// This email was used before the integration of Braintree Marketplace, to report about the
    /// need for manual paymento to providers. Now payment is automatic, triggered by a refund or the ScheduledTask
    /// that asks Braintree to proceed with the payment.
    /// Then this email is not need, Loconomics stuff doesn't need to do anything for payment and this is just
    /// informational.
    /// </summary>
    /// <param name="bookingID"></param>
    public static void SendProviderPaymentRequestToLoconomics(int bookingID)
    {
        SendMail("support@loconomics.com", "Provider Payment Request",
            ApplyTemplate(LcUrl.LangPath + "Email/EmailProviderPaymentRequest/",
            new Dictionary<string,object> {
                { "BookingID", bookingID },
                { "EmailTo", "support@loconomics.com" }
         }));
    }
    #endregion

    #region Type:MerchantAccountNotification
    public static void SendMerchantAccountNotification(int providerUserID)
    {
        SendMail("support@loconomics.com", "Marketplace: Merchant Account Notification",
            ApplyTemplate(LcUrl.LangPath + "Email/EmailProviderPaymentAccountNotification/",
            new Dictionary<string,object> {
                { "ProviderID", providerUserID},
                { "EmailTo", "support@loconomics.com" }
         }));
    }
    #endregion

    #region Template System
    public static string ApplyTemplate(string tplUrl, Dictionary<string, object> data)
    {
        string rtn = "";

        using (WebClient w = new WebClient())
        {
            w.Encoding = System.Text.Encoding.UTF8;

            // Setup URL
            string completeURL = LcUrl.SiteUrl + LcUrl.GetTheGoodURL(tplUrl);
            if (LcHelpers.Channel != "live")
            {
                completeURL = completeURL.Replace("https:", "http:");
            }

            // First, we need substract from the URL the QueryString to be
            // assigned to the WebClient object, avoiding problems while
            // manipulating the w.QueryString directly, and allowing both vias (url and data paramenter)
            // to set paramenters
            var uri = new Uri(completeURL);
            w.QueryString = HttpUtility.ParseQueryString(uri.Query);
            completeURL = uri.GetLeftPart(UriPartial.Path);

            if (data != null)
            foreach (var d in data)
            {
                w.QueryString.Add(d.Key, (d.Value ?? "").ToString());
            }
            if (!w.QueryString.AllKeys.Contains<string>("RequestKey"))
                w.QueryString["RequestKey"] = SecurityRequestKey;

            try
            {
                rtn = w.DownloadString(completeURL);
            }
            catch (WebException exception)
            {
                string responseText;
                using (var reader = new System.IO.StreamReader(exception.Response.GetResponseStream()))
                {
                    responseText = reader.ReadToEnd();
                }
                string qs = GetWebClientQueryString(w);
                using (var logger = new LcLogger("SendMail"))
                {
                    logger.Log("Email ApplyTemplate URL:{0}", completeURL + qs);
                    logger.LogEx("Email ApplyTemplate exception (previous logged URL)", exception);
                    logger.Save();
                }
                if (LcHelpers.InDev)
                {
                    HttpContext.Current.Trace.Warn("LcMessagging.ApplyTemplate", "Error creating template " + completeURL + qs, exception);
                    throw new Exception(exception.Message + "::" + responseText);
                }
                else
                {
                    NotifyError("LcMessaging.ApplyTemplate", completeURL + qs, responseText);
                    throw new Exception("Email could not be sent");
                }
            }
            catch (Exception ex)
            {
                using (var logger = new LcLogger("SendMail"))
                {
                    logger.Log("Email ApplyTemplate URL: {0}", completeURL + GetWebClientQueryString(w));
                    logger.LogEx("Email ApplyTemplate exception (previous logged URL)", ex);
                    logger.Save();
                }
                throw new Exception("Email could not be sent");
            }
            // Next commented line are test for another tries to get web content processed,
            // can be usefull test if someone have best performance than others, when need.
            //HttpContext.Current.Response.Output = null;
            //var o = new System.IO.StringWriter();
            //var r = new System.Web.Hosting.SimpleWorkerRequest(tplUrl, "", o);
            //Server.Execute()
            //System.Web.UI.PageParser.GetCompiledPageInstance
        }

        return rtn;
    }
    private static string GetWebClientQueryString(WebClient w)
    {
        string qs = "?";
        foreach (var v in w.QueryString.AllKeys)
        {
            qs += v + "=" + w.QueryString[v] + "&";
        }
        return qs;
    }
    private static readonly string SecurityRequestKey = "abcd3";
    public static void SecureTemplate()
    {
        if ((LcHelpers.InLive && !HttpContext.Current.Request.IsLocal) ||
            HttpContext.Current.Request["RequestKey"] != SecurityRequestKey)
            throw new HttpException(403, "Forbidden");
    }
    #endregion

    #region Generic app utilities
    public static void NotifyError(string where, string url, string exceptionPageContent)
    {
        try
        {
            SendMail("support@loconomics.com", LcHelpers.Channel + ": Exception on " + where + ": " + url,
                exceptionPageContent);
        }
        catch { }
    }
    #endregion

    #region Send Mail wrapper function
    private static bool LogSuccessSendMail
    {
        get
        {
            try
            {
                return System.Configuration.ConfigurationManager.AppSettings["LogSuccessSendMail"] == "true";
            }
            catch
            {
                return false;
            }
        }
    }
    public static void SendMail(string to, string subject, string body, string from = null)
    {
        // No mails for local development.
        if (LcHelpers.Channel == "localdev") return;

        SendMailNow(to, subject, body, from);
        //ScheduleEmail(TimeSpan.FromMinutes(1), to, subject, body, from);
    }
    private static void SendMailNow(string to, string subject, string body, string from = null)
    {
        try
        {
            WebMail.Send(to, subject, body, from, contentEncoding: "utf-8");

            if (LogSuccessSendMail)
            {
                using (var logger = new LcLogger("SendMail"))
                {
                    logger.Log("SUCCESS WebMail.Send, to:{0}, subject:{1}, from:{2}", to, subject, from);
                    logger.Save();
                }
            }
        }
        catch (Exception ex) {
            using (var logger = new LcLogger("SendMail"))
            {
                logger.Log("WebMail.Send, to:{0}, subject:{1}, from:{2}, body::", to, subject, from);
                if (!String.IsNullOrEmpty(body)) {
                    logger.LogData(body);
                }
                else {
                    logger.Log("**There is no message body**");
                }
                logger.LogEx("SendMail (previous logged email)", ex);
                logger.Save();
            }
        }
    }
    #endregion

    #region Email Scheduling
    /// <summary>
    /// Schedules an email to be sended after the delayTime especified.
    /// Technically, this method create a Cache event that expires after 3h, sending the email after that.
    /// 
    /// TODO: at the moment there is no fallback security, if the server stops or crashs for some reason
    /// the info might be lost, the event should be also stored in DDBB for manual/automated recovery
    /// in case of system failure.
    /// </summary>
    /// <param name="delayTime"></param>
    /// <param name="emailto"></param>
    /// <param name="emailsubject"></param>
    /// <param name="emailbody"></param>
    public static bool SendMailDelayed(TimeSpan delayTime, string emailto, string emailsubject, string emailbody, string from = null)
    {
        try
        {
            HttpContext.Current.Cache.Insert("ScheduledEmail: " + emailsubject,
                new Dictionary<string, string>()
                {
                    { "emailto", emailto },
                    { "emailsubject", emailsubject },
                    { "emailbody", emailbody },
                    { "emailfrom", from }
                },
                null,
                System.Web.Caching.Cache.NoAbsoluteExpiration, delayTime,
                CacheItemPriority.Normal,
                new CacheItemRemovedCallback(ScheduleEmailCacheItemRemovedCallback));

            return true;
        }
        catch
        {
            return false;
        }
    }
    /// <summary>
    /// Cache Callback that Sends the email
    /// </summary>
    /// <param name="key"></param>
    /// <param name="value"></param>
    /// <param name="reason"></param>
    static void ScheduleEmailCacheItemRemovedCallback(string key, object value, CacheItemRemovedReason reason)
    {
        try
        {
            Dictionary<string, string> emaildata = (Dictionary<string, string>)value;

            string emailto = emaildata["emailto"];
            string body = emaildata["emailbody"]; //"This is a test e-mail message sent using loconomics as a relay server ";
            string subject = emaildata["emailsubject"]; //"Loconomics test email";
            string from = emaildata["emailfrom"];

            SendMailNow(emailto, subject, body, from);

            // TODO: Test using the normal API for email sending, trying to solve current problem with
            // emails not being sent by this way:
            /*
                SmtpClient client = new SmtpClient("mail.loconomics.com", 25);
                client.EnableSsl = false;
                client.Credentials = new NetworkCredential("automated@loconomics.com", "Loconomic$2011");
                MailAddress from = new MailAddress(from);
                MailAddress to = new MailAddress(mail);
                MailMessage message = new MailMessage(from, to);
                client.SendAsync(message,"testing");
             */
        }
        catch (Exception ex)
        {
            if (HttpContext.Current != null)
                HttpContext.Current.Trace.Warn("LcMessaging.ScheduleEmail=>CacheItemRemovedCallback Error: " + ex.ToString());
            using (var logger = new LcLogger("SendMail"))
            {
                logger.LogEx("ScheduleEmail exception getting details from cache", ex);
                logger.Save();
            }
        }
    }
    #endregion
}